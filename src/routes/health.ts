// ตัวอย่าง src/routes/health.ts หรือไฟล์ที่แม็พ /api/health/db
import { prismaRead } from "../lib/prisma";
import { URL } from "url";

// (ออปชัน) debug ชั่วคราว: โชว์ว่าต่อ host ไหนอยู่ (ตัดทิ้งทีหลัง)
function maskHost(u?: string) {
  try {
    const url = new URL(u!);
    const h = url.hostname;
    return h.replace(/^[^.]+/, "ep-xxxxx"); // ปิดบัง
  } catch { return "n/a"; }
}

app.get("/api/health/db", async (_req, res) => {
  try {
    await prismaRead.$queryRaw`SELECT 1`;
    res.json({ db: "up", via: "pooled" });
  } catch (e: any) {
    res.status(500).json({
      db: "down",
      via: "pooled",
      host: maskHost(process.env.READONLY_POOL_URL || process.env.DATABASE_POOL_URL),
      error: String(e?.message || e),
    });
  }
});
