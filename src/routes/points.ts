// src/routes/points.ts
import type { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

// helper: ดึง userId จาก JWT ที่ authOptional ใส่ไว้ใน req.user (ถ้าคุณใช้ฟิลด์อื่น แก้ตรงนี้)
function getUserId(req: Request): string | null {
  // ตัวอย่าง payload: { sub: "user-id", wallet?: "..." }
  const anyReq = req as any;
  const payload = anyReq.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

export default function mountPoints(router: Router) {
  // GET /api/points/balance
  router.get("/points/balance", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      // เปลี่ยนชื่อโมเดล/ฟิลด์ให้ตรง schema ของคุณ
      const bal = await prisma.pointsBalance.findUnique({
        where: { userId },
      });

      res.json({
        ok: true,
        balance: bal?.balance ?? 0,
        updatedAt: bal?.updatedAt ?? null,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/points/history?limit=50
  router.get("/points/history", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const limit = Math.min(Number(req.query.limit ?? 50), 200);

      // เปลี่ยนชื่อโมเดล/ฟิลด์ให้ตรง schema ของคุณ
      const rows = await prisma.pointsEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      res.json({ ok: true, items: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // POST /api/points/earn  { amount: number, type?: string, meta?: object }
  const earnBody = z.object({
    amount: z.number().int().positive(),
    type: z.string().max(64).optional().default("generic"),
    meta: z.record(z.any()).optional(),
  });

  router.post("/points/earn", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const parsed = earnBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
      }
      const { amount, type, meta } = parsed.data;

      // ใช้ transaction: insert event + upsert balance
      const result = await prisma.$transaction(async (tx) => {
        // เปลี่ยนชื่อโมเดล/ฟิลด์ให้ตรง schema ของคุณ
        const ev = await tx.pointsEvent.create({
          data: {
            userId,
            type,
            amount,
            meta: meta ? (meta as any) : undefined,
          },
        });

        const bal = await tx.pointsBalance.upsert({
          where: { userId },
          create: { userId, balance: amount },
          update: { balance: { increment: amount } },
        });

        return { ev, bal };
      });

      res.status(201).json({
        ok: true,
        added: amount,
        balance: result.bal.balance,
        eventId: result.ev.id,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/points/leaderboard?limit=10
  router.get("/points/leaderboard", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 10), 100);

      // เปลี่ยนชื่อโมเดล/ฟิลด์ให้ตรง schema ของคุณ
      const rows = await prisma.pointsBalance.findMany({
        orderBy: { balance: "desc" },
        take: limit,
        select: { userId: true, balance: true, updatedAt: true },
      });

      res.json({ ok: true, items: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
