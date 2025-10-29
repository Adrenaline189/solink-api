// src/routes/auth.ts
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export default function authRoutes(app: Express) {
  app.post("/api/auth/demo-login", async (req: Request, res: Response) => {
    // ตัวอย่าง: รับ walletAddress แล้วออก token เดโม่
    const { wallet } = (req.body ?? {}) as { wallet?: string };
    if (!wallet) return res.status(400).json({ ok: false, error: "wallet required" });

    // คุณจะปรับ logic จริงทีหลังได้
    const token = jwt.sign({ id: wallet, wallet }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.json({ ok: true, token });
  });
}
