import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string | undefined)?.trim();
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const settings = await prisma.setting.findUnique({ where: { userId } });
    return res.json(settings || {});
  } catch (e: any) {
    console.error("GET /api/settings error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "internal error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, range, timezone } = req.body || {};
    if (!userId || !range || !timezone) {
      return res.status(400).json({ error: "Missing fields: userId, range, timezone" });
    }

    const saved = await prisma.setting.upsert({
      where: { userId },
      update: { range, timezone },
      create: { userId, range, timezone },
    });

    return res.json(saved);
  } catch (e: any) {
    console.error("POST /api/settings error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "internal error" });
  }
});

export default router;