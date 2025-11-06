// src/routes/points.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authOptional } from "../middleware/auth.js";

// schema สำหรับ earn: บังคับ type และให้ต้องมี meta.session
const earnSchema = z.object({
  type: z.literal("extension_farm"),
  amount: z.number().int().positive(),
  meta: z.object({
    session: z.string().min(1),
  }),
});

export default function mountPoints(router: Router) {
  // POST /api/points/earn
  router.post(
    "/points/earn",
    authOptional,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;
      const wallet =
        typeof req.user.wallet === "string" ? req.user.wallet : userId;

      try {
        const { type, amount, meta } = earnSchema.parse(req.body);

        // ensure user exists
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: { id: userId, wallet },
        });

        // สร้าง event (จะชน unique index ถ้า session เดิม)
        const event = await prisma.pointEvent.create({
          data: { userId, type, amount, meta },
        });

        const agg = await prisma.pointEvent.aggregate({
          where: { userId },
          _sum: { amount: true },
        });

        return res.json({ ok: true, event, balance: agg._sum.amount ?? 0 });
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        const code = err?.code;

        const isDuplicate =
          code === "P2002" ||
          msg.includes("uniq_point_extfarm_session") ||
          msg.includes("Unique constraint failed") ||
          msg.includes("COALESCE(meta ->> 'session'");

        if (isDuplicate) {
          // ไม่เพิ่มแต้ม (idempotent)
          const agg = await prisma.pointEvent.aggregate({
            where: { userId },
            _sum: { amount: true },
          });
          return res.status(200).json({
            ok: true,
            deduped: true,
            event: null,
            balance: agg._sum.amount ?? 0,
          });
        }

        // error อื่น ๆ
        console.error("[points/earn] error", err);
        return res
          .status(400)
          .json({ ok: false, error: err?.message ?? "Bad request" });
      }
    }
  );

  // GET /api/points/balance
  router.get(
    "/points/balance",
    authOptional,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;

      const agg = await prisma.pointEvent.aggregate({
        where: { userId },
        _sum: { amount: true },
      });

      res.json({ ok: true, balance: agg._sum.amount ?? 0 });
    }
  );

  // GET /api/points/events?limit=10
  router.get(
    "/points/events",
    authOptional,
    async (req: Request, res: Response) => {
      if (!req.user || typeof req.user.sub !== "string") {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      const userId: string = req.user.sub;
      const limit = Math.min(Number(req.query.limit ?? 20), 100);

      const events = await prisma.pointEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      res.json({ ok: true, events });
    }
  );
}
