import type { Express } from "express";
import { prismaRead } from "../lib/prisma";

export function mountHealth(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "api" }));

  app.get("/api/health/db", async (_req, res) => {
    try {
      await prismaRead.$queryRaw`SELECT 1`;
      res.json({ db: "up" });
    } catch (e: any) {
      res.status(500).json({ db: "down", error: String(e?.message || e) });
    }
  });
}
