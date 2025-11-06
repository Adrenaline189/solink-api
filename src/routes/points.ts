// src/routes/points.ts
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authOptional } from "../middleware/auth.js";

/**
 * Earn schemas
 * - extension_farm: regular earning ticks from extension (idempotent via meta.session)
 * - referral_bonus: one-time reward for referrer (normally created by backend logic)
 */
const earnExtensionSchema = z.object({
  type: z.literal("extension_farm"),
  amount: z.number().int().positive(),
  meta: z.object({
    session: z.string().min(1),       // idempotency key (unique per tick)
    poolId: z.string().min(1).optional(),  // optional grouping key if you use pools/rooms
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

/** ENV helpers */
function getReferralBonusAmount(): number {
  const raw = process.env.REFERRAL_BONUS_POINTS;
  const n = raw ? Number(raw) : 100;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

/**
 * Concurrency window in minutes.
 * Default 7 days (10080). Hard-capped at 7 days for safety.
 */
function concurrencyWindowMin(): number {
  const raw = Number(process.env.REFERRAL_CONCURRENCY_WINDOW_MIN ?? "10080");
  const val = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10080;
  return Math.min(val, 10080);
}

function requireConcurrency(): boolean {
  return (process.env.REFERRAL_REQUIRE_CONCURRENCY ?? "true").toLowerCase() === "true";
}

function matchKey(): string | null {
  const k = (process.env.REFERRAL_MATCH_KEY ?? "").trim();
  return k.length ? k : null;
}

/** Minimum active days for referrer in the window (recommend 3) */
function minActiveDays(): number {
  const raw = Number(process.env.REFERRAL_MIN_ACTIVE_DAYS ?? "3");
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 3;
}

/** SQL helpers for performance and compatibility */
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

  // Load referred user (no Prisma select to keep TS compatibility while schema is evolving)
  const referredUser = await prisma.user.findUnique({
    where: { id: referredUserId },
  });

  // Compat: read referrerId via "any" to avoid TS errors if Prisma Client hasn't generated the field yet
  const referrerId = (referredUser as any)?.referrerId ?? null;
  if (!referrerId || referrerId === referredUserId) return null;

  if (requireConcurrency()) {
    const minutes = concurrencyWindowMin();
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const key = matchKey();
    const val =
      key && referredMeta && typeof referredMeta[key] === "string" ? String(referredMeta[key]) : null;

    // (a) referrer must have at least one event within the window (and match key if configured)
    const hasAny = await hasReferrerEventWithin(referrerId, since, key, val);
    if (!hasAny) return null;

    // (b) referrer must be active at least N distinct days in the window
    const needDays = minActiveDays();
    if (needDays > 0) {
      const days = await countActiveDaysForReferrerWithin(referrerId, since, key, val);
      if (days < needDays) return null;
    }
  }

  const amount = getReferralBonusAmount();
  try {
    const event = await prisma.pointEvent.create({
      data: {
        userId: referrerId,
        type: "referral_bonus",
        amount,
        meta: {
          referredUserId,
          reason: "first_earn",
          matchedKey: matchKey() ?? undefined,
          matchedVal: matchKey() ? referredMeta?.[matchKey()!] : undefined,
        } as any,
      },
    });
    return event;
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const code = err?.code;
    const isDuplicate =
      code === "P2002" ||
      msg.includes("uniq_point_referral_firstearn") ||
      msg.includes("Unique constraint failed");
    if (isDuplicate) return null;
    throw err;
  }
}

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
        typeof (req as any).user.wallet === "string" ? (req as any).user.wallet : userId;

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

          // Check if this is the user's FIRST ever event
          const totalCount = await prisma.pointEvent.count({ where: { userId } });
          if (totalCount === 1) {
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
