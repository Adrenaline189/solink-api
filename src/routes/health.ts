// src/routes/health.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const r = Router();

// GET /api/health
r.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

// GET /api/health/db
r.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      db: "up",
      via: "pooled",
      host: process.env.DATABASE_POOL_URL || process.env.DATABASE_URL,
    });
  } catch (e: any) {
    res.status(500).json({ db: "down", error: String(e?.message || e) });
  }
});

export default r;
