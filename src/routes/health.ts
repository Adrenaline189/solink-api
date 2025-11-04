// src/routes/health.ts
import type { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// Extract safe metadata from DATABASE_URL without leaking credentials
function parseDbMeta(rawUrl?: string) {
  if (!rawUrl) return undefined;
  try {
    const u = new URL(rawUrl);
    return {
      host: u.hostname,                                // e.g. ep-xxxx.ap-southeast-1.aws.neon.tech
      pooled: u.searchParams.get("pgbouncer") === "true",
    };
  } catch {
    return undefined;
  }
}

export default function mountHealth(router: Router) {
  // Lightweight service health
  router.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  // DB health without leaking password/connection string
  router.get("/health/db", async (_req: Request, res: Response) => {
    try {
      // ping DB
      await prisma.$queryRaw`SELECT 1`;

      const raw = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || "";
      const meta = parseDbMeta(raw);

      res.json({
        ok: true,
        via: meta?.pooled ? "pooled" : "direct",
        dbHost: meta?.host,
      });
    } catch {
      // อย่า log error ลง response ใน production เพื่อไม่ให้ข้อมูลภายในรั่ว
      res.status(500).json({ ok: false, error: "DB check failed" });
    }
  });
}
