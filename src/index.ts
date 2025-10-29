// src/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import settingsRoutes from "./routes/settings.js";
import healthRoutes from "./routes/health.js";

const app = express();
app.use(express.json());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const ALLOW_ORIGINS = [
  "https://www.solink.network",
  "https://app.solink.network",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked by server"));
    },
    credentials: true
  })
);

app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// mount routes
healthRoutes(app);
authRoutes(app);
settingsRoutes(app);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Solink API running on :${port}`));
