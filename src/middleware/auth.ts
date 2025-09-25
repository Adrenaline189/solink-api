import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { id: string; wallet?: string | null };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) return next();
    const token = h.slice("Bearer ".length);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    if (payload && payload.id) req.user = { id: String(payload.id), wallet: payload.wallet ?? null };
  } catch {}
  next();
}
