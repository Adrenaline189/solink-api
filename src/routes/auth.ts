// src/routes/auth.ts
import type { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export default function mountAuth(router: Router) {
  /**
   * 🔹 DEMO LOGIN — สำหรับออก token ทดสอบโดยใช้ wallet address
   * ใช้เพื่อจำลองการ login หรือ test กับ frontend
   */
  router.post("/auth/demo-login", async (req: Request, res: Response) => {
    try {
      const wallet = (req.body?.wallet as string | undefined) || null;

      // สร้าง user ID สมมุติ (หรือตรวจจริงจาก DB)
      const id = wallet ? wallet.slice(0, 16) : "guest";

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({ ok: false, error: "Missing JWT_SECRET" });
      }

      const token = jwt.sign({ sub: id, wallet }, secret, { expiresIn: "7d" });

      res.json({ ok: true, token });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  /**
   * 🔹 TOKEN TEST — ใช้เฉพาะตอน dev เพื่อขอ JWT ทดสอบ
   * ปิดอัตโนมัติใน production
   */
  router.get("/auth/token-test", (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        ok: false,
        error: "This endpoint is disabled in production",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ ok: false, error: "Missing JWT_SECRET" });
    }

    const token = jwt.sign(
      { user: "test@solink.network" },
      secret,
      { expiresIn: "1h" }
    );

    res.json({
      ok: true,
      env: process.env.NODE_ENV,
      token,
    });
  });

  /**
   * 🔹 VERIFY TOKEN — ใช้ตรวจสอบว่า JWT ที่ส่งมาถูกต้องหรือไม่
   */
  router.get("/auth/check", async (req: Request, res: Response) => {
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, error: "Missing token" });
      }

      const token = auth.slice(7);
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({ ok: false, error: "Missing JWT_SECRET" });
      }

      const decoded = jwt.verify(token, secret);
      res.json({ ok: true, user: decoded });
    } catch (e: any) {
      res.status(401).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
