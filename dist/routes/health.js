import { prismaRead } from "../lib/prisma.js";
import { PrismaClient } from "@prisma/client";
function maskHost(u) {
    try {
        const { hostname } = new URL(u);
        return hostname.replace(/^[^.]+/, "ep-xxxxx");
    }
    catch {
        return "n/a";
    }
}
export function mountHealth(app) {
    app.get("/api/health", (_req, res) => {
        res.json({ ok: true, service: "api" });
    });
    app.get("/api/debug/db-url", (_req, res) => {
        res.json({
            DATABASE_URL_HOST: maskHost(process.env.DATABASE_URL),
            DATABASE_POOL_URL_HOST: maskHost(process.env.DATABASE_POOL_URL),
        });
    });
    app.get("/api/health/db", async (_req, res) => {
        let testClient;
        try {
            const pooledUrl = process.env.DATABASE_POOL_URL;
            if (!pooledUrl) {
                return res.status(500).json({ db: "down", via: "pooled", error: "DATABASE_POOL_URL not set" });
            }
            testClient = new PrismaClient({ datasources: { db: { url: pooledUrl } } });
            // @ts-ignore
            await testClient.$queryRaw `SELECT 1`;
            // @ts-ignore
            await prismaRead.$queryRaw `SELECT 1`;
            res.json({ db: "up", via: "pooled", host: maskHost(pooledUrl) });
        }
        catch (e) {
            res.status(500).json({ db: "down", via: "pooled", error: String(e?.message || e) });
        }
        finally {
            if (testClient) {
                try {
                    await testClient.$disconnect();
                }
                catch { }
            }
        }
    });
}
