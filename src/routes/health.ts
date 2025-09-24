import type { Express, Request, Response } from "express";
import { prismaRead } from "../lib/prisma.js";

export function mountHealth(app: Express) {
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  app.get("/api/health/db", async (_req: Request, res: Response) => {
    try {
      await prismaRead.$queryRaw`SELECT 1`;
      res.json({ db: "up" });
    } catch (e: any) {
      res.status(500).json({ db: "down", error: String(e?.message || e) });
    }
  });
}
