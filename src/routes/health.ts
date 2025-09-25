import type { Express, Request, Response } from "express";
import { prismaRead } from "../lib/prisma.js";
import { PrismaClient } from "@prisma/client";

function maskHost(u?: string) {
  try {
    const { hostname } = new URL(u!);
    return hostname.replace(/^[^.]+/, "ep-xxxxx");
  } catch {
    return "n/a";
  }
}

export function mountHealth(app: Express) {
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "api" });
  });

  app.get("/api/debug/db-url", (_req: Request, res: Response) => {
    res.json({
      DATABASE_URL_HOST: maskHost(process.env.DATABASE_URL),
      DATABASE_POOL_URL_HOST: maskHost(process.env.DATABASE_POOL_URL),
    });
  });

  app.get("/api/health/db", async (_req: Request, res: Response) => {
    let testClient: PrismaClient | undefined;
    try {
      const pooledUrl = process.env.DATABASE_POOL_URL;
      if (!pooledUrl) {
        return res.status(500).json({ db: "down", via: "pooled", error: "DATABASE_POOL_URL not set" });
      }
      testClient = new PrismaClient({ datasources: { db: { url: pooledUrl } } });
      // @ts-ignore
      await testClient.$queryRaw`SELECT 1`;
      // @ts-ignore
      await prismaRead.$queryRaw`SELECT 1`;
      res.json({ db: "up", via: "pooled", host: maskHost(pooledUrl) });
    } catch (e: any) {
      res.status(500).json({ db: "down", via: "pooled", error: String(e?.message || e) });
    } finally {
      if (testClient) {
        try { await testClient.$disconnect(); } catch {}
      }
    }
  });
}
