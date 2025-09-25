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

async function loadMergedSettings(userId: string | null) {
  const [globals, personals] = await Promise.all([
    prismaRead.setting.findMany({ where: { userId: null } }),
    prismaRead.setting.findMany({ where: { userId: userId ?? undefined } }),
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
  app.use("/api/settings", authOptional);

  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? null;
      const settings = await loadMergedSettings(userId);
      res.json({ ok: true, settings, source: "db", userId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const parsed = settingsBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) return bad(res, "Invalid body", parsed.error.flatten());
      const body = parsed.data;
      const entries = Object.entries(body).filter(([k]) => (allowedKeys as readonly string[]).includes(k));
      if (entries.length === 0) return bad(res, "No supported fields");
      const userId = req.user?.id ?? null;
      await prismaWrite.$transaction(
        entries.map(([key, val]) =>
          prismaWrite.setting.upsert({
            where: { userId_key: { userId, key } },
            create: { userId, key, value: toJsonString(val) },
            update: { value: toJsonString(val) },
          })
        )
      );
      res.json({ ok: true, updated: body, scope: userId ? "user" : "global", userId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  app.put("/api/settings/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) return bad(res, "Missing id");
      const { value } = req.body ?? {};
      if (typeof value === "undefined") return bad(res, "Missing value");
      const updated = await prismaWrite.setting.update({ where: { id }, data: { value: toJsonString(value) } });
      let parsed: unknown = updated.value;
      try { parsed = JSON.parse(updated.value); } catch {}
      res.json({ ok: true, id, updated: parsed, source: "db" });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
