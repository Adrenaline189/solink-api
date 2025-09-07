import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import settingsRoutes from "./routes/settings";

const app = express();
const PORT = process.env.PORT || 4000;

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// JSON body
app.use(express.json());

// CORS allowlist
const allow = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow curl/health checks with no Origin
      if (!origin) return cb(null, true);
      return allow.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS"));
    },
    credentials: false
  })
);

// Basic rate limit for /api/*
app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000, // 1 minute
    max: 120,         // 120 req/min/IP
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Health
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Solink API running 🚀" });
});

// Routes
app.use("/api/settings", settingsRoutes);

// 404
app.use((_req: Request, res: Response) =>
  res.status(404).json({ error: "Not found" })
);

app.listen(PORT, () => {
  console.log(`✅ Solink API listening on port ${PORT}`);
});
