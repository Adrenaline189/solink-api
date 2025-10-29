// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type JwtPayloadLoose = {
  sub?: string;
  id?: string;
  wallet?: string | null;
  iat?: number;
  exp?: number;
};

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayloadLoose;
      const id = String(payload.id ?? payload.sub ?? "");
      if (id) {
        req.user = {
          id,
          wallet: payload.wallet ?? null,
          sub: payload.sub
        };
      }
    } catch {
      // token ไม่ถูกต้องก็ปล่อยผ่าน (optional)
    }
  }
  next();
}
