// src/routes/health.ts
import type { Express, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export default function healthRoutes(app: Express) {
  app.get("/api/health", (_: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  app.get("/api/health/db", async (_: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        db: "up",
        via: "pooled",
        host: process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL ?? "unknown"
      });
    } catch (e: any) {
      res.status(500).json({ db: "down", error: String(e?.message || e) });
    }
  });
}
