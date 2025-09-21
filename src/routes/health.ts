import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Health check service itself
router.get("/", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

// DB health check
router.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: "up" });
  } catch (error: any) {
    res.json({ db: "down", error: error.message });
  }
});

export default router;
