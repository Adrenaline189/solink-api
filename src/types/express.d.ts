// src/types/express.d.ts
import "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      wallet?: string | null;
      sub?: string;
    }
    interface Request {
      user?: UserPayload;
    }
  }
}
export {};
