import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET settings
router.get("/", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const settings = await prisma.setting.findUnique({ where: { userId } });
    if (!settings) return res.status(404).json({ error: "No settings found" });
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST/UPSERT settings
router.post("/", async (req, res) => {
  const { userId, range, timezone } = req.body;
  if (!userId || !range || !timezone) {
    return res.status(400).json({ error: "Missing fields: userId, range, timezone" });
  }

  try {
    const saved = await prisma.setting.upsert({
      where: { userId },
      update: { range, timezone, updatedAt: new Date() },
      create: { userId, range, timezone },
    });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
