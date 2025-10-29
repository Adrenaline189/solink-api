// src/routes/settings.ts
import type { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const allowedKeys = ["lang", "theme"] as const;
const settingsBodySchema = z.object({
  lang: z.string().optional(),
  theme: z.string().optional()
}).strip();

function toJsonString(v: unknown) {
  return typeof v === "string" ? v : JSON.stringify(v);
}

async function loadMergedSettings(userId: string | null) {
  const globals = await prisma.setting.findMany({ where: { userId: null } });
  const personals = userId
    ? await prisma.setting.findMany({ where: { userId } })
    : ([] as typeof globals);

  const map = new Map<string, string>();
  for (const r of globals) map.set(r.key, r.value);
  for (const r of personals) map.set(r.key, r.value);

  const out: Record<string, unknown> = {};
  for (const [k, raw] of map.entries()) {
    try { out[k] = JSON.parse(raw); } catch { out[k] = raw; }
  }
  return out;
}

export default function mountSettings(router: Router) {
  // GET /api/settings
  router.get("/settings", async (req: Request, res: Response) => {
    try {
      const userId: string | null = req.user?.id ?? null;
      const settings = await loadMergedSettings(userId);
      return res.json({ ok: true, settings, source: "db", userId });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // POST /api/settings — upsert หลาย key
  router.post("/settings", async (req: Request, res: Response) => {
    try {
      const parsed = settingsBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid body", details: parsed.error.flatten() });
      }
      const body = parsed.data;

      const entries = Object.entries(body).filter(([k]) =>
        (allowedKeys as readonly string[]).includes(k as any)
      ) as Array<[typeof allowedKeys[number], string]>;

      if (entries.length === 0) {
        return res.status(400).json({ ok: false, error: "No supported fields" });
      }

      const userId: string | null = req.user?.id ?? null;

      await prisma.$transaction(async (tx) => {
        for (const [key, val] of entries) {
          const value = toJsonString(val);

          if (userId) {
            await tx.setting.upsert({
              where: { userId_key: { userId, key } },
              create: { userId, key, value },
              update: { value }
            });
          } else {
            const existing = await tx.setting.findFirst({
              where: { userId: null, key },
              select: { id: true }
            });

            if (existing) {
              await tx.setting.update({
                where: { id: existing.id },
                data: { value }
              });
            } else {
              await tx.setting.create({
                data: { userId: null, key, value }
              });
            }
          }
        }
      });

      const obj = Object.fromEntries(entries.map((entry) => [entry[0], entry[1]]));
      return res.json({
        ok: true,
        updated: obj,
        scope: userId ? "user" : "global",
        userId
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
