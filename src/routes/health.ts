import type { Express, Request, Response } from "express";
import { prismaRead } from "../lib/prisma.js";
import { PrismaClient } from "@prisma/client";

// ปิดบัง host ใน URL (เช่น postgres://user:pass@ep-xxxxx…)
function maskHost(u?: string) {
  try {
    const { hostname } = new URL(u!);
    return hostname.replace(/^[^.]+/, "ep-xxxxx");
  } catch {
    return "n/a";
  }
}

export function mountHealth(app: Express) {
  // สถานะพื้นฐานของ API
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  // DEBUG: โชว์ host จาก env (ตัดหัว)
  app.get("/api/debug/db-url", (_req: Request, res: Response) => {
    res.json({
      DATABASE_URL_HOST: maskHost(process.env.DATABASE_URL),
      DATABASE_POOL_URL_HOST: maskHost(process.env.DATABASE_POOL_URL),
    });
  });

  // ตรวจสุขภาพ DB (พยายามใช้ pooled URL ก่อน)
  app.get("/api/health/db", async (_req: Request, res: Response) => {
    let testClient: PrismaClient | undefined;
    try {
      const pooledUrl = process.env.DATABASE_POOL_URL;
      if (!pooledUrl) {
        return res.status(500).json({
          db: "down",
          via: "pooled",
          usedHost: "n/a",
          error: "DATABASE_POOL_URL is not set",
        });
      }

      // (A) ทดสอบ connection ตรง ๆ ด้วย client ชั่วคราว (pooled URL)
      testClient = new PrismaClient({ datasources: { db: { url: pooledUrl } } });
      // @ts-ignore - ใช้ sql template ของ Prisma
      await testClient.$queryRaw`SELECT 1`;

      // (B) ถ้า (A) ผ่าน ค่อยทดสอบด้วย client กลางของแอป (ควรชี้ pooled เช่นกัน)
      // @ts-ignore
      await prismaRead.$queryRaw`SELECT 1`;

      res.json({ db: "up", via: "pooled", host: maskHost(pooledUrl) });
    } catch (e: any) {
      res.status(500).json({
        db: "down",
        via: "pooled",
        usedHost: maskHost(process.env.DATABASE_POOL_URL),
        error: String(e?.message || e),
      });
    } finally {
      // ปิด client ชั่วคราวป้องกัน connection ค้าง
      if (testClient) {
        try {
          await testClient.$disconnect();
        } catch {
          /* noop */
        }
      }
    }
  });
}
