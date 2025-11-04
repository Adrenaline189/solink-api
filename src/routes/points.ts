// src/routes/points.ts
import type { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

/** ใช้กับทุก endpoint ในไฟล์นี้: ต้องมี user จาก JWT */
function requireUser(req: Request, res: Response, next: NextFunction) {
  const u = (req as any).user || {};
  const sub = u.sub || u.user || u.wallet;
  if (!sub) return res.status(401).json({ ok: false, error: "Unauthorized" });
  (req as any).__subject = String(sub);
  next();
}

export default function mountPoints(router: Router) {
  // ใช้ middleware นี้กับทุกเส้นทางแต้ม
  router.use("/points", requireUser);

  /** POST /api/points/earn  -> เพิ่ม event + คืน balance ล่าสุด */
  router.post("/points/earn", async (req: Request, res: Response) => {
    try {
      const subject = (req as any).__subject as string;
      const { type, amount, meta } = req.body ?? {};

      if (typeof type !== "string" || !type.trim()) {
        return res.status(400).json({ ok: false, error: "type is required" });
      }
      if (typeof amount !== "number" || !Number.isInteger(amount)) {
        return res.status(400).json({ ok: false, error: "amount must be integer" });
      }

      // ผูก user ตาม wallet/sub
      const wallet = subject;
      const user = await prisma.user.upsert({
        where: { wallet },
        update: {},
        create: { wallet },
        select: { id: true }
      });

      // บันทึก event แต้ม
      const event = await prisma.pointEvent.create({
        data: { userId: user.id, type, amount, meta: meta ?? undefined }
      });

      // สรุปยอดคงเหลือ
      const agg = await prisma.pointEvent.aggregate({
        _sum: { amount: true },
        where: { userId: user.id }
      });
      const balance = agg._sum.amount ?? 0;

      return res.json({ ok: true, event, balance });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** GET /api/points/balance -> ยอดแต้มคงเหลือ */
  router.get("/points/balance", async (req: Request, res: Response) => {
    try {
      const subject = (req as any).__subject as string;
      const wallet = subject;

      const user = await prisma.user.findUnique({
        where: { wallet },
        select: { id: true }
      });
      if (!user) return res.json({ ok: true, balance: 0 });

      const agg = await prisma.pointEvent.aggregate({
        _sum: { amount: true },
        where: { userId: user.id }
      });
      const balance = agg._sum.amount ?? 0;

      return res.json({ ok: true, balance });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /** GET /api/points/events?limit=20 -> ประวัติล่าสุด */
  router.get("/points/events", async (req: Request, res: Response) => {
    try {
      const subject = (req as any).__subject as string;
      const wallet = subject;

      const user = await prisma.user.findUnique({
        where: { wallet },
        select: { id: true }
      });
      if (!user) return res.json({ ok: true, events: [] });

      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(String((req.query as any).limit ?? 20), 10) || 20)
      );

      const events = await prisma.pointEvent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit
      });

      return res.json({ ok: true, events });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
