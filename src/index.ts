import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

app.get("/api/health/db", async (_req, res) => {
  try {
    const [{ ok }] = await prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 as ok");
    res.json({ db: ok === 1 ? "up" : "down" });
  } catch (e: any) {
    console.error("DB health error:", e);
    res.status(500).json({ error: e?.message || "db error" });
  }
});
