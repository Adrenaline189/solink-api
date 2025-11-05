// src/routes/points.ts
import type { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

function getUserFromReq(req: Request): { id: string; wallet?: string | null } | null {
  const u = (req as any).user; // มาจาก authOptional ถ้ามี
  if (!u?.sub) return null;
  return { id: String(u.sub), wallet: u.wallet ?? null };
}

export default function mountPoints(router: Router) {
  // POST /api/points/earn  { type, amount, meta? }
  router.post("/points/earn", async (req: Request, res: Response) => {
    try {
      const u = getUserFromReq(req);
      if (!u) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const amount = Number(req.body?.amount ?? 0);
      const type = String(req.body?.type ?? "");
      const meta = req.body?.meta as any | undefined;

      if (!type || !Number.isFinite(amount) || amount === 0) {
        return res.status(400).json({ ok: false, error: "Invalid type/amount" });
      }

      // ensure user exists
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: { id: u.id, wallet: u.wallet ?? null },
      });

      const event = await prisma.pointEvent.create({
        data: { userId: u.id, type, amount, meta },
      });

      const agg = await prisma.pointEvent.aggregate({
        where: { userId: u.id },
        _sum: { amount: true },
      });

      return res.json({ ok: true, event, balance: agg._sum.amount ?? 0 });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/points/balance
  router.get("/points/balance", async (req: Request, res: Response) => {
    try {
      const u = getUserFromReq(req);
      if (!u) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const agg = await prisma.pointEvent.aggregate({
        where: { userId: u.id },
        _sum: { amount: true },
      });

      return res.json({ ok: true, balance: agg._sum.amount ?? 0 });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/points/events?limit=10
  router.get("/points/events", async (req: Request, res: Response) => {
    try {
      const u = getUserFromReq(req);
      if (!u) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);

      const events = await prisma.pointEvent.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return res.json({ ok: true, events });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
