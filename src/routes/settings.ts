// src/routes/settings.ts
import type { Express, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authOptional } from "../middleware/auth.js";

export default function settingsRoutes(app: Express) {
  app.use("/api/settings", authOptional);

  // GET merged settings (global + user)
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? null;

      const [globals, personals] = await Promise.all([
        prisma.setting.findMany({ where: { userId: null } }),
        userId ? prisma.setting.findMany({ where: { userId } }) : Promise.resolve([])
      ]);

      const map = new Map<string, string>();
      for (const r of globals) map.set(r.key, r.value);
      for (const r of personals) map.set(r.key, r.value);

      const entries = Array.from(map.entries()).map(([key, value]) => ({ key, value }));
      const obj = Object.fromEntries(
        entries.map((e: { key: string; value: string }) => {
          try {
            return [e.key, JSON.parse(e.value)];
          } catch {
            return [e.key, e.value];
          }
        })
      );

      return res.json({ ok: true, settings: obj, source: "db", userId });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // POST upsert keys (global if not logged-in, else user scope)
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? null;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const keys = Object.keys(body);
      if (keys.length === 0) return res.status(400).json({ ok: false, error: "No keys" });

      await prisma.$transaction(async (tx) => {
        for (const key of keys) {
          const raw = body[key];
          const value = typeof raw === "string" ? raw : JSON.stringify(raw);

          if (userId) {
            // composite unique: (userId, key)
            await tx.setting.upsert({
              where: { userId_key: { userId, key } },
              create: { userId, key, value },
              update: { value }
            });
          } else {
            // global (userId null) – ใช้ findFirst → update/create
            const existing = await tx.setting.findFirst({
              where: { userId: null, key },
              select: { id: true }
            });
            if (existing) {
              await tx.setting.update({ where: { id: existing.id }, data: { value } });
            } else {
              await tx.setting.create({ data: { userId: null, key, value } });
            }
          }
        }
      });

      return res.json({ ok: true, updated: body, scope: userId ? "user" : "global", userId });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
