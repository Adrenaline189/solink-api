// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; wallet?: string | null };
    }
  }
}

type MyJwtPayload = JwtPayload & {
  id?: string;
  sub?: string;
  wallet?: string | null;
};

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.split(" ")[1];
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as MyJwtPayload;
      const id = payload.id ?? (payload.sub ? String(payload.sub) : undefined);
      if (id) req.user = { id: String(id), wallet: payload.wallet ?? null };
    }
  } catch {
    // ignore
  }
  next();
}
