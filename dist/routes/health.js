import { prisma } from "../lib/prisma.js";
export default function mountHealth(router) {
    router.get("/health", (_req, res) => {
        res.json({ ok: true, service: "api" });
    });
    router.get("/health/db", async (_req, res) => {
        try {
            await prisma.$queryRaw `SELECT 1`;
            res.json({
                ok: true,
                via: "pooled",
                host: process.env.DATABASE_POOL_URL || process.env.DATABASE_URL
            });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e) });
        }
    });
}
