import type { Express, Request, Response } from "express";
import { prismaWrite } from "../lib/prisma.js";

export function mountSettings(app: Express) {
  // GET
  app.get("/api/settings", async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // POST
  app.post("/api/settings", async (req: Request, res: Response) => {
    res.json({ ok: true, body: req.body });
  });

  // PUT
  app.put("/api/settings/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    res.json({ ok: true, id, body: req.body });
  });
}
