import type { Express, Request, Response } from "express";
import { prismaWrite, prismaRead } from "../lib/prisma.js";

// helper: ตอบ error รูปแบบเดียวกัน
function sendBadRequest(res: Response, msg: string, details?: unknown) {
  return res.status(400).json({ ok: false, error: msg, details });
}

/**
 * สมมติว่ามีตาราง Settings เก็บ config (key/value per scope)
 * ถ้ายังไม่มี schema จริง ก็ให้ GET/POST ทำงานแบบ echo ชั่วคราวได้
 * - GET  /api/settings                => คืนค่าคอนฟิก (mock ถ้าไม่มี DB)
 * - POST /api/settings                => อัปเดตคอนฟิกรายการ (theme, lang, ฯลฯ)
 * - PUT  /api/settings/:id            => อัปเดตรายการตาม id (เผื่อใช้ภายหลัง)
 */
export function mountSettings(app: Express) {
  // GET /api/settings — ดึงค่าปัจจุบัน
  app.get("/api/settings", async (_req: Request, res: Response) => {
    try {
      // ถ้ามีตารางจริง: ตัวอย่าง pseudo-query
      // const items = await prismaRead.settings.findMany();
      // return res.json({ ok: true, items });

      // mock ค่าพื้นฐาน (ถ้ายังไม่ทำ DB)
      return res.json({
        ok: true,
        settings: {
          theme: "light",
          lang: "en",
        },
        source: "mock",
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // POST /api/settings — อัปเดตคอนฟิก (ตัวอย่าง: theme/lang)
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const { theme, lang, ...rest } = req.body ?? {};

      // validation เบา ๆ
      if (theme && !["light", "dark", "system"].includes(String(theme))) {
        return sendBadRequest(res, "Invalid theme", { allow: ["light", "dark", "system"] });
      }
      if (lang && typeof lang !== "string") {
        return sendBadRequest(res, "Invalid lang");
      }

      // ถ้ามี DB:
      // await prismaWrite.settings.upsert({ ... })

      // ตอบกลับสิ่งที่รับมา (mock write)
      return res.json({
        ok: true,
        updated: {
          ...(theme ? { theme } : {}),
          ...(lang ? { lang } : {}),
          ...rest, // เผื่อค่าอื่น ๆ
        },
        source: "mock",
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // PUT /api/settings/:id — ตัวอย่าง endpoint ระบุตาม id (เผื่อในอนาคต)
  app.put("/api/settings/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) return sendBadRequest(res, "Missing id");

      // สมมติอัปเดตฟิลด์ที่อนุญาต
      const { theme, lang, ...rest } = req.body ?? {};
      if (!theme && !lang && Object.keys(rest).length === 0) {
        return sendBadRequest(res, "No fields to update");
      }

      // ถ้ามี DB:
      // const updated = await prismaWrite.settings.update({ where: { id }, data: {...} });

      // mock response
      return res.json({
        ok: true,
        id,
        updated: {
          ...(theme ? { theme } : {}),
          ...(lang ? { lang } : {}),
          ...rest,
        },
        source: "mock",
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
