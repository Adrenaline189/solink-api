// src/routes/health.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// Health แบบไม่แตะ DB
router.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "api" });
});

// Health แบบเช็ค DB
router.get("/db", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: "up" });
  } catch (e: any) {
    res.status(500).json({ db: "down", error: e?.message || "db error" });
  }
});

export default router;
