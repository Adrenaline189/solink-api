// src/routes/auth.ts
import type { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export default function mountAuth(router: Router) {
  // ตัวอย่าง demo-login เพื่อออก token ทดสอบ
  router.post("/auth/demo-login", async (req: Request, res: Response) => {
    try {
      const wallet = (req.body?.wallet as string | undefined) || null;

      // สมมุติหรือตรวจ user จาก DB ตามจริงก็ได้
      const id = wallet ? wallet.slice(0, 16) : "guest";

      const token = jwt.sign(
        { sub: id, wallet },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
      );

      res.json({ ok: true, token });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
