// src/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import settingsRoutes from "./routes/settings.js";

const app = express();
app.use(express.json());

// Helmet (เปิดใช้ CORP แบบ cross-origin เพื่อให้ image/font โหลดข้ามโดเมนได้)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS allowlist
const ALLOW_ORIGINS = [
  "https://www.solink.network",
  "https://app.solink.network",
  "http://localhost:3000",
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked by server"));
    },
    credentials: true,
  }),
);

// Rate limit
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// Mount routes
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", settingsRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Solink API running on :${port}`);
});
