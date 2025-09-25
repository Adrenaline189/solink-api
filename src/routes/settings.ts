import type { Express, Request, Response } from "express";
import { prismaWrite, prismaRead } from "../lib/prisma.js";
import { authOptional } from "../middleware/auth.js";
import { settingsBodySchema, allowedKeys } from "../validation/settings.js";

function bad(res: Response, msg: string, details?: unknown) {
  return res.status(400).json({ ok: false, error: msg, details });
}

function toJsonString(v: unknown) {
  return typeof v === "string" ? v : JSON.stringify(v);
}

// รวมค่า global + user (user override global)
async function loadMergedSettings(userId: string | null) {
  const [globals, personals] = await Promise.all([
    prismaRead.setting.findMany({ where: { userId: null } }),
    userId
      ? prismaRead.setting.findMany({ where: { userId } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prismaRead.setting.findMany>>)
  ]);

  const map = new Map<string, string>();
  for (const r of globals) map.set(r.key, r.value);
  for (const r of personals) map.set(r.key, r.value);

  const out: Record<string, unknown> = {};
  for (const [k, raw] of map.entries()) {
    try { out[k] = JSON.parse(raw); } catch { out[k] = raw; }
  }
  return out;
}

export function mountSettings(app: Express) {
  // auth optional ใต้ path นี้
  app.use("/api/settings", authOptional);

  // GET /api/settings
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const userId: string | null = req.user?.id ?? null;
      const settings = await loadMergedSettings(userId);
      return res.json({ ok: true, settings, source: "db", userId });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // POST /api/settings — upsert หลาย key
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const parsed = settingsBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) return bad(res, "Invalid body", parsed.error.flatten());
      const body = parsed.data;

      const entries = Object.entries(body).filter(([k]) =>
        (allowedKeys as readonly string[]).includes(k)
      );
      if (entries.length === 0) return bad(res, "No supported fields");

      const userId: string | null = req.user?.id ?? null;

      await prismaWrite.$transaction(async (tx) => {
        for (const [key, val] of entries) {
          const value = toJsonString(val);

          if (userId) {
            // ผู้ใช้ล็อกอิน → ใช้ upsert กับ composite key ได้
            await tx.setting.upsert({
              where: { userId_key: { userId, key } }, // userId เป็น string แน่นอนในสาขานี้
              create: { userId, key, value },
              update: { value }
            });
          } else {
            // global (userId = null) → ห้าม upsert composite key (NULL ใน unique)
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

      return res.json({
        ok: true,
        updated: body,
        scope: userId ? "user" : "global",
        userId
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // PUT /api/settings/:id — อัปเดตรีคอร์ดเดียว
  app.put("/api/settings/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) return bad(res, "Missing id");

      const { value } = req.body ?? {};
      if (typeof value === "undefined") return bad(res, "Missing value");

      const updated = await prismaWrite.setting.update({
        where: { id },
        data: { value: toJsonString(value) }
      });

      let parsed: unknown = updated.value;
      try { parsed = JSON.parse(updated.value); } catch {}

      return res.json({ ok: true, id, updated: parsed, source: "db" });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
