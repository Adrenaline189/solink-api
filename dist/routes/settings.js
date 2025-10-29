import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
const r = Router();
const UpsertReq = z.object({
    settings: z.record(z.string().max(128), z.string().max(2048)),
});
r.get("/", async (req, res) => {
    const userId = req.user?.sub ?? null;
    if (!userId) {
        const entries = await prisma.setting.findMany({
            where: { userId: null },
            take: 100,
        });
        const obj = Object.fromEntries(entries.map((e) => [e.key, e.value]));
        const lang = obj["lang"] ?? "th";
        const theme = obj["theme"] ?? "light";
        return res.json({ ok: true, settings: { lang, theme }, source: "db", userId: null });
    }
    const entries = await prisma.setting.findMany({
        where: { OR: [{ userId }, { userId: null }] },
        take: 200,
    });
    const map = new Map();
    for (const e of entries) {
        if (e.userId === null && !map.has(e.key))
            map.set(e.key, e.value);
    }
    for (const e of entries) {
        if (e.userId === userId)
            map.set(e.key, e.value);
    }
    return res.json({ ok: true, settings: Object.fromEntries(map.entries()), source: "db", userId });
});
r.put("/", async (req, res) => {
    const userId = req.user?.sub;
    if (!userId)
        return res.status(401).json({ ok: false, error: "unauthorized" });
    const parse = UpsertReq.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ ok: false, error: "bad_request" });
    const entries = Object.entries(parse.data.settings);
    await Promise.all(entries.map(([key, value]) => prisma.setting.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, value },
        update: { value },
    })));
    return res.json({ ok: true, updated: entries.length });
});
export default r;
