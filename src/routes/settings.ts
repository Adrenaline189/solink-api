// src/routes/settings.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authOptional } from "../middleware/auth.js";

const r = Router();
r.use(authOptional);

// กำหนด key ที่อนุญาต
const allowedKeys = ["lang", "theme"] as const;
type AllowedKey = (typeof allowedKeys)[number];

// แปลง unknown เป็น string JSON
function toJsonString(v: unknown) {
  return typeof v === "string" ? v : JSON.stringify(v);
}

// โหลด settings รวม global + user (user override global)
async function loadMergedSettings(userId: string | null) {
  const [globals, personals] = await Promise.all([
    prisma.setting.findMany({ where: { userId: null } }),
    userId ? prisma.setting.findMany({ where: { userId } }) : Promise.resolve([]),
  ]);

  const map = new Map<string, string>();
  for (const g of globals) map.set(g.key, g.value);
  for (const p of personals) map.set(p.key, p.value);

  const out: Record<string, unknown> = {};
  for (const [k, raw] of map.entries()) {
    try {
      out[k] = JSON.parse(raw);
    } catch {
      out[k] = raw;
    }
  }
  return out;
}

// GET /api/settings
r.get("/settings", async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const settings = await loadMergedSettings(userId);
    res.json({ ok: true, settings, source: "db", userId });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// POST /api/settings  — upsert หลาย key
r.post("/settings", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const entries = Object.entries(body).filter(([k]) =>
      (allowedKeys as readonly string[]).includes(k as AllowedKey),
    ) as [AllowedKey, unknown][];

    if (entries.length === 0) {
      return res.status(400).json({ ok: false, error: "No supported fields" });
    }

    const userId = req.user?.id ?? null;

    await prisma.$transaction(async (tx) => {
      for (const [key, val] of entries) {
        const value = toJsonString(val);

        if (userId) {
          // user scope
          await tx.setting.upsert({
            where: { userId_key: { userId, key } },
            create: { userId, key, value },
            update: { value },
          });
        } else {
          // global scope (userId = null) ต้องเช็คเองเพราะ composite unique ไม่ครอบคลุม null
          const existing = await tx.setting.findFirst({
            where: { userId: null, key },
            select: { id: true },
          });

          if (existing) {
            await tx.setting.update({ where: { id: existing.id }, data: { value } });
          } else {
            await tx.setting.create({ data: { userId: null, key, value } });
          }
        }
      }
    });

    res.json({
      ok: true,
      updated: Object.fromEntries(entries),
      scope: userId ? "user" : "global",
      userId,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default r;
