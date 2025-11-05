// src/routes/points.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authed } from "../middleware/auth.js";

const earnSchema = z.object({
  type: z.enum(["extension_farm"]),
  amount: z.number().int().positive().max(10_000),
  meta: z.object({
    session: z.string().min(1).max(200)
  })
});

const router = Router();

router.post("/points/earn", authed, async (req, res) => {
  const user = req.user!;

  try {
    const { type, amount, meta } = earnSchema.parse(req.body);

    // ensure user row exists
    await prisma.user.upsert({
      where: { id: user.sub },
      update: {},
      create: { id: user.sub, wallet: user.wallet ?? user.sub },
    });

    // try to insert a new point event
    const event = await prisma.pointEvent.create({
      data: { userId: user.sub, type, amount, meta },
    });

    const agg = await prisma.pointEvent.aggregate({
      where: { userId: user.sub },
      _sum: { amount: true },
    });

    return res.json({ ok: true, event, balance: agg._sum.amount ?? 0 });
  } catch (err: any) {
    const msg: string = String(err?.message ?? "");
    const code: string | undefined = err?.code;

    // === สำคัญ: ดักกรณียิงซ้ำ ===
    const duplicateHit =
      code === "P2002" ||
      msg.includes("uniq_point_extfarm_session") ||
      msg.includes("Unique constraint failed") ||
      msg.includes("COALESCE(meta ->> 'session'");

    if (duplicateHit) {
      // no-op: ไม่บวกแต้มเพิ่ม แต่อัปเดต balance ปัจจุบันให้
      const agg = await prisma.pointEvent.aggregate({
        where: { userId: req.user!.sub },
        _sum: { amount: true },
      });
      return res.status(200).json({
        ok: true,
        deduped: true,
        event: null,          // ไม่สร้างซ้ำ
        balance: agg._sum.amount ?? 0,
      });
    }

    // error อื่น ๆ
    console.error("[points/earn] error", err);
    return res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
  }
});

router.get("/points/balance", authed, async (req, res) => {
  const agg = await prisma.pointEvent.aggregate({
    where: { userId: req.user!.sub },
    _sum: { amount: true },
  });
  res.json({ ok: true, balance: agg._sum.amount ?? 0 });
});

router.get("/points/events", authed, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const events = await prisma.pointEvent.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json({ ok: true, events });
});

export default (r: Router) => {
  r.use(router);
};
