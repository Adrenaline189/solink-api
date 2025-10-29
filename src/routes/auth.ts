// src/routes/auth.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const r = Router();

/** ตัวอย่าง route ออก token ทดสอบ */
r.post("/auth/demo", async (_req, res) => {
  const token = jwt.sign({ sub: "demo-user" }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  res.json({ ok: true, token });
});

export default r;
