import type { Express, Request, Response } from "express";
import { prismaWrite } from "../lib/prisma.js";

export function mountSettings(app: Express) {
  app.get("/api/settings", async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    // ตัวอย่าง: เขียนข้อมูลลง DB
    // await prismaWrite.setting.upsert({ ... })
    res.json({ ok: true, body: req.body });
  });

  app.put("/api/settings/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    // await prismaWrite.setting.update({ where: { id }, data: { ... } })
    res.json({ ok: true, id });
  });
}
