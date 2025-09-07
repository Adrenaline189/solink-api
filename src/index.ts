import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";

// ---- Prisma (1 instance per process) ----
const prisma = new PrismaClient();

// ---- App & Security Middlewares ----
const app = express();

const ALLOWED = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman
      if (ALLOWED.length === 0) return cb(null, true);
      if (ALLOWED.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

// Basic rate limit (tune as needed)
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---- Health: app (no DB) ----
app.get("/", (_req, res) => {
  res.json({ message: "Solink API running 🚀" });
});

// ---- Health: DB (with Prisma) ----
app.get("/api/health/db", async (_req, res) => {
  try {
    // simple query
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    const ok = Array.isArray(rows) && rows[0]?.ok === 1;
    res.json({ db: ok ? "up" : "down" });
  } catch (e: any) {
    console.error("DB health error:", e?.message || e);
    res.status(500).json({ db: "down", error: e?.message || "db error" });
  }
});

// ---- Routes ----
import settingsRouter from "./routes/settings";
app.use("/api/settings", settingsRouter);

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ---- Error handler ----
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
);

// ---- Start server ----
const port = Number(process.env.PORT) || 4000;
// IMPORTANT on Render: bind to 0.0.0.0
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Solink API listening on port ${port}`);
});
