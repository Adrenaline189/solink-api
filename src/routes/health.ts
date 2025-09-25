import type { Express, Request, Response } from "express";
import { prismaRead } from "../lib/prisma.js"; // <- สำคัญ: ESM ต้อง .js

export function mountHealth(app: Express) {
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  app.get("/api/health/db", async (_req: Request, res: Response) => {
    try {
      // ยิงผ่าน pooled
      await prismaRead.$queryRaw`SELECT 1`;
      res.json({ db: "up" });
    } catch (e: any) {
      // โชว์ข้อความสั้น ๆ พอ
      res.status(500).json({ db: "down", error: String(e?.message || e) });
    }
  });
}
