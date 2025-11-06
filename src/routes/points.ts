// src/routes/points.ts
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authOptional } from "../middleware/auth.js";

/** ---------- Helpers / ENV ---------- */

function boolEnv(name: string, def: boolean): boolean {
  const v = (process.env[name] ?? "").toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}
function numEnv(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : def;
}

const REFERRAL_ENABLED = boolEnv("REFERRAL_ENABLED", true);
const REFERRAL_REQUIRE_CONCURRENCY = boolEnv("REFERRAL_REQUIRE_CONCURRENCY", true);
const REFERRAL_BONUS_POINTS = Math.max(1, Math.floor(numEnv("REFERRAL_BONUS_POINTS", 100)));
const REFERRAL_MATCH_KEY = (process.env.REFERRAL_MATCH_KEY ?? "").trim() || null;

/** Minimum active days for referrer in the window (recommend 3) */
function minActiveDays(): number {
  const raw = Number(process.env.REFERRAL_MIN_ACTIVE_DAYS ?? "3");
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 3;
}

/** Concurrency window in minutes. Default 7 days (10080). Hard-capped at 7 days. */
function concurrencyWindowMin(): number {
  const raw = Number(process.env.REFERRAL_CONCURRENCY_WINDOW_MIN ?? "10080");
  const val = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10080;
  return Math.min(val, 10080);
}

/** ---------- Zod Schemas ---------- */

/**
 * Earn schemas
 * - extension_farm: regular earning ticks from extension (idempotent via meta.session)
 * - referral_bonus: one-time reward for referrer (normally created by backend logic)
 */
const earnExtensionSchema = z.object({
  type: z.literal("extension_farm"),
  amount: z.number().int().positive(),
  meta: z.object({
    session: z.string().min(1), // idempotency key (unique per tick)
    poolId: z.string().min(1).optional(), // optional grouping key if you use pools/rooms
    partyId: z.string().min(1).optional(),
  }),
});

const earnReferralSchema = z.object({
  type: z.literal("referral_bonus"),
  amount: z.number().int().positive(),
  meta: z.object({
    referredUserId: z.string().min(1),
    reason: z.enum(["signup", "first_earn"]).default("first_earn"),
  }),
});

// Allow both; client typically sends only extension_farm
const earnSchema = z.union([earnExtensionSchema, earnReferralSchema]);

/** ---------- Rate limit ---------- */
/**
 * Per-user rate limiter:
 * - 30 requests per minute per authenticated user (fallback to IP when unauthenticated)
 */
const earnLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const sub = (req as any)?.user?.sub;
    return typeof sub === "string" ? `u:${sub}` : `ip:${req.ip}`;
  },
  handler: (_req, res) => {
    return res.status(429).json({
      ok: false,
      error: "Too many requests. Please try again in a moment.",
    });
  },
});

/** ---------- SQL helpers ---------- */

// Runtime-safe: fetch referrerId even if Prisma model doesn't have the field yet
async function getReferrerId(userId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ referrerId: string | null }[]>`
    SELECT "referrerId" FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  return (rows?.[0]?.referrerId ?? null) as string | null;
}

async function countActiveDaysForReferrerWithin(
  referrerId: string,
  since: Date,
  key?: string | null,
  val?: string | null
): Promise<number> {
  if (key && val) {
    const rows = await prisma.$queryRaw<{ days: bigint }[]>`
      SELECT COUNT(DISTINCT DATE("createdAt")) AS days
      FROM "PointEvent"
      WHERE "userId" = ${referrerId}
        AND "type" = 'extension_farm'
        AND "createdAt" >= ${since}
        AND COALESCE("meta"->>${key}, '') = ${val}
    `;
    return Number(rows?.[0]?.days ?? 0);
  } else {
    const rows = await prisma.$queryRaw<{ days: bigint }[]>`
      SELECT COUNT(DISTINCT DATE("createdAt")) AS days
      FROM "PointEvent"
      WHERE "userId" = ${referrerId}
        AND "type" = 'extension_farm'
        AND "createdAt" >= ${since}
    `;
    return Number(rows?.[0]?.days ?? 0);
  }
}

async function hasReferrerEventWithin(
  referrerId: string,
  since: Date,
  key?: string | null,
  val?: string | null
): Promise<boolean> {
  if (key && val) {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM "PointEvent"
        WHERE "userId" = ${referrerId}
          AND "type" = 'extension_farm'
          AND "createdAt" >= ${since}
          AND COALESCE("meta"->>${key}, '') = ${val}
        LIMIT 1
      ) AS exists
    `;
    return Boolean(rows?.[0]?.exists);
  } else {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM "PointEvent"
        WHERE "userId" = ${referrerId}
          AND "type" = 'extension_farm'
          AND "createdAt" >= ${since}
        LIMIT 1
      ) AS exists
    `;
    return Boolean(rows?.[0]?.exists);
  }
}

/** ---------- Referral bonus core (with loud logs) ---------- */
/**
 * Attempt to award the referral bonus exactly once when:
 *  - referred user has a valid referrer
 *  - this is referred user's VERY FIRST earn
 *  - (if enabled) referrer has activity within the window
 *  - (if configured) matchKey value equals (e.g., same poolId)
 *  - (if configured) referrer is active at least N distinct days within the window
 * Idempotent by unique index on (type='referral_bonus', meta->>'referredUserId').
 */
async function tryAwardFirstEarnReferralBonus(params: {
  referredUserId: string;
  referredMeta: Record<string, any>;
}) {
  const { referredUserId, referredMeta } = params;

  if (!REFERRAL_ENABLED) {
    console.log("[referral] disabled via REFERRAL_ENABLED=false");
    return null;
  }

  // Fetch referrerId via raw SQL (works even if Prisma client schema is behind)
  const referrerId = await getReferrerId(referredUserId);

  if (!referrerId || referrerId === referredUserId) {
    console.warn("[referral] missing/loop referrerId", { referredUserId, referrerId });
    return null;
  }

  // Concurrency & activity gates
  if (REFERRAL_REQUIRE_CONCURRENCY) {
    const minutes = concurrencyWindowMin();
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const key = REFERRAL_MATCH_KEY;
    const val =
      key && referredMeta && typeof referredMeta[key] === "string"
        ? String(referredMeta[key])
        : null;

    console.log("[referral] gate check", {
      referrerId,
      referredUserId,
      minutes,
      since: since.toISOString(),
      key,
      val,
      needDays: minActiveDays(),
    });

    const hasAny = await hasReferrerEventWithin(referrerId, since, key, val);
    console.log("[referral] hasReferrerEventWithin =", hasAny);
    if (!hasAny) return null;

    const needDays = minActiveDays();
    if (needDays > 0) {
      const days = await countActiveDaysForReferrerWithin(referrerId, since, key, val);
      console.log("[referral] activeDays =", days, "need =", needDays);
      if (days < needDays) return null;
    }
  } else {
    console.log("[referral] REFERRAL_REQUIRE_CONCURRENCY=false (skipping gate)");
  }

  // Create referral bonus (idempotent by partial unique index)
  try {
    const event = await prisma.pointEvent.create({
      data: {
        userId: referrerId,
        type: "referral_bonus",
        amount: REFERRAL_BONUS_POINTS,
        meta: {
          referredUserId,
          reason: "first_earn",
          matchedKey: REFERRAL_MATCH_KEY ?? undefined,
          matchedVal: REFERRAL_MATCH_KEY ? (referredMeta as any)?.[REFERRAL_MATCH_KEY] : undefined,
        } as any,
      },
    });
    console.log("[referral] bonus created", {
      eventId: event.id,
      referrerId,
      referredUserId,
      amount: REFERRAL_BONUS_POINTS,
    });
    return event;
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const code = err?.code;
    const isDuplicate =
      code === "P2002" ||
      msg.includes("uniq_point_referral_firstearn") ||
      msg.includes("Unique constraint failed");
    if (isDuplicate) {
      console.log("[referral] duplicate bonus suppressed", { referredUserId });
      return null;
    }
    console.error("[referral] create error", err);
    throw err;
  }
}

/** ---------- Router ---------- */

export default function mountPoints(router: Router) {
  /**
   * POST /api/points/earn
   * - Auth required
   * - Rate limited
   * - Idempotent for extension_farm via unique (userId, meta.session) partial index
   * - Tries to award referral_bonus (once) on referred user's first earn, subject to gates
   */
  router.post(
    "/points/earn",
    authOptional,
    earnLimiter,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;
      const wallet =
        typeof (req as any).user?.wallet === "string" ? (req as any).user.wallet : userId;

      try {
        const parsed = earnSchema.parse(req.body);

        // Ensure user exists
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: { id: userId, wallet },
        });

        let createdEvent: any = null;

        if (parsed.type === "extension_farm") {
          // Create earn event (unique by meta.session enforced by DB partial index)
          createdEvent = await prisma.pointEvent.create({
            data: {
              userId,
              type: parsed.type,
              amount: parsed.amount,
              meta: parsed.meta as any,
            },
          });

          // Count AFTER insertion – if this is the very first event for this user, try awarding.
          const totalCount = await prisma.pointEvent.count({ where: { userId } });
          console.log("[earn] user total events after insert =", { userId, totalCount });

          if (totalCount === 1) {
            console.log("[referral] first-earn detected; attempting bonus", {
              referredUserId: userId,
              meta: parsed.meta,
              REFERRAL_ENABLED,
              REFERRAL_REQUIRE_CONCURRENCY,
              REFERRAL_MATCH_KEY,
              REFERRAL_BONUS_POINTS,
              windowMin: concurrencyWindowMin(),
              minActiveDays: minActiveDays(),
            });

            try {
              await tryAwardFirstEarnReferralBonus({
                referredUserId: userId,
                referredMeta: parsed.meta,
              });
            } catch (e) {
              console.error("[points/referral-bonus] error", e);
            }
          }
        } else if (parsed.type === "referral_bonus") {
          // Optional/admin path only; do not expose to untrusted clients
          createdEvent = await prisma.pointEvent.create({
            data: {
              userId,
              type: parsed.type,
              amount: parsed.amount,
              meta: parsed.meta as any,
            },
          });
        }

        const agg = await prisma.pointEvent.aggregate({
          where: { userId },
          _sum: { amount: true },
        });

        return res.json({
          ok: true,
          event: createdEvent,
          balance: agg._sum.amount ?? 0,
        });
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        const code = err?.code;

        const isDuplicate =
          code === "P2002" ||
          msg.includes("uniq_point_extfarm_session") ||
          msg.includes("uniq_point_referral_firstearn") ||
          msg.includes("Unique constraint failed") ||
          msg.includes("COALESCE(meta ->> 'session'");

        if (isDuplicate) {
          const agg = await prisma.pointEvent.aggregate({
            where: { userId },
            _sum: { amount: true },
          });
          return res.status(200).json({
            ok: true,
            deduped: true,
            event: null,
            balance: agg._sum.amount ?? 0,
          });
        }

        console.error("[points/earn] error", err);
        return res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
      }
    }
  );

  /** GET /api/points/balance */
  router.get(
    "/points/balance",
    authOptional,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;

      const agg = await prisma.pointEvent.aggregate({
        where: { userId },
        _sum: { amount: true },
      });

      res.json({ ok: true, balance: agg._sum.amount ?? 0 });
    }
  );

  /** GET /api/points/events?limit=10 */
  router.get(
    "/points/events",
    authOptional,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;
      const limit = Math.min(Number(req.query.limit ?? 20), 100);

      const events = await prisma.pointEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      res.json({ ok: true, events });
    }
  );

  /**
   * Optional: quick referral stats for the current user
   * - total bonus amount
   * - distinct referred users count (via meta.referredUserId)
   */
  router.get(
    "/points/referral/stats",
    authOptional,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;

      const totalReferralEarn = await prisma.pointEvent.aggregate({
        where: { userId, type: "referral_bonus" },
        _sum: { amount: true },
      });

      const rows = await prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "meta"->>'referredUserId') AS cnt
        FROM "PointEvent"
        WHERE "userId" = ${userId}
          AND "type" = 'referral_bonus'
      `;

      res.json({
        ok: true,
        bonusTotal: totalReferralEarn._sum.amount ?? 0,
        referredCount: Number(rows?.[0]?.cnt ?? 0),
      });
    }
  );
}
