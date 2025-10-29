// src/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import mountAuth from "./routes/auth.js";
import mountSettings from "./routes/settings.js";
import mountHealth from "./routes/health.js";
import { authOptional } from "./middleware/auth.js";

const app = express();
app.use(express.json());

// Helmet และ CSP พื้นฐาน
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// CORS allowlist
const ALLOW_ORIGINS = [
  "https://www.solink.network",
  "https://app.solink.network",
  "http://localhost:3000"
] as const;

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOW_ORIGINS.includes(origin as any)) return cb(null, true);
      cb(new Error("CORS blocked by server"));
    },
    credentials: true
  })
);

// Rate limit
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// Health routes (ไม่ต้อง auth)
const publicRouter = express.Router();
mountHealth(publicRouter);
app.use("/api", publicRouter);

// Auth optional ใต้ /api (เช่น /api/settings)
app.use("/api", authOptional);

// Feature routes
const featureRouter = express.Router();
mountAuth(featureRouter);
mountSettings(featureRouter);
app.use("/api", featureRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Solink API running on :${port}`);
});
