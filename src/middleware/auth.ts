// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// เพิ่ม type ของ user ที่จะใส่ใน req
export interface AuthedUser {
  id: string;
  wallet?: string | null;
  sub?: string;
}

// augment express Request
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload | string;

      if (typeof payload === "string") {
        // บางระบบ sign เป็น string ล้วน ๆ
        req.user = { id: payload };
      } else {
        // รองรับทั้ง id และ sub + wallet (ถ้ามี)
        const id = (payload as any).id ?? payload.sub ?? null;
        const wallet = (payload as any).wallet ?? null;
        if (id) req.user = { id: String(id), wallet, sub: payload.sub };
      }
    } catch {
      // โทเค็นเสีย/หมดอายุ -> ปล่อยผ่านแบบ optional
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}
