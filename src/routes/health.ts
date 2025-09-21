import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// Service health
router.get("/", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

// DB health
router.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: "up" });
  } catch (err: any) {
    res.json({ db: "down", error: err.message });
  }
});

export default router;
