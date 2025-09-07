import { Router, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/settings?userId=0x123
 */
router.get("/", async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const settings = await prisma.setting.findUnique({ where: { userId } });
  return res.json(settings || {});
});

/**
 * POST /api/settings
 * { "userId": "0x123", "range": "7d", "timezone": "Asia/Bangkok" }
 */
router.post("/", async (req: Request, res: Response) => {
  const { userId, range, timezone } = req.body || {};
  if (!userId || !range || !timezone) {
    return res.status(400).json({ error: "Missing fields: userId, range, timezone" });
  }

  const saved = await prisma.setting.upsert({
    where: { userId },
    update: { range, timezone },
    create: { userId, range, timezone }
  });

  return res.json(saved);
});

export default router;
