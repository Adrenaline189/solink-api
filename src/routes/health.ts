import type { Express, Request, Response } from "express";
import { prismaRead } from "../lib/prisma.js";
import { PrismaClient } from "@prisma/client";

function maskHost(u?: string) {
  try {
    const { hostname } = new URL(u!);
    return hostname.replace(/^[^.]+/, "ep-xxxxx"); // ปิดบังส่วนนำ
  } catch { return "n/a"; }
}

export function mountHealth(app: Express) {
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  // --- DEBUG: โชว์ว่าตอนนี้ env ชี้ host อะไรอยู่
  app.get("/api/debug/db-url", (_req: Request, res: Response) => {
    res.json({
      DATABASE_URL_HOST: maskHost(process.env.DATABASE_URL),
      DATABASE_POOL_URL_HOST: maskHost(process.env.DATABASE_POOL_URL),
    });
  });

  app.get("/api/health/db", async (_req: Request, res: Response) => {
    try {
      // (A) ทดสอบด้วย client ที่ "บังคับ" pooled URL โดยตรง
      const pooledUrl = process.env.DATABASE_POOL_URL!;
      const testClient = new PrismaClient({ datasources: { db: { url: pooledUrl } } });
      await testClient.$queryRaw`SELECT 1`;

      // (B) ถ้าข้อ (A) ผ่าน เราค่อยใช้ client กลางตามปกติ (ควรชี้ pooled เหมือนกัน)
      await prismaRead.$queryRaw`SELECT 1`;

      res.json({ db: "up", via: "pooled" });
    } catch (e: any) {
      res.status(500).json({
        db: "down",
        via: "pooled",
        usedHost: maskHost(process.env.DATABASE_POOL_URL),
        error: String(e?.message || e),
      });
    }
  });
}
