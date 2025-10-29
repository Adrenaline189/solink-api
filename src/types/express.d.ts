import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      sub: string; // wallet address
      iat?: number;
      exp?: number;
    };
  }
}
