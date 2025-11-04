// src/index.ts
import express, { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

// Routes/Middleware
import mountAuth from "./routes/auth.js";
import mountSettings from "./routes/settings.js";
import mountHealth from "./routes/health.js";
import mountPoints from "./routes/points.js"; // ✅ เพิ่ม router แต้ม
import { authOptional } from "./middleware/auth.js";

/* -------------------------------------------
 * App bootstrap
 * -----------------------------------------*/
const app = express();
app.set("trust proxy", 1); // ช่วยให้อ่าน IP หลัง Proxy/Cloudflare/Render ถูกต้อง
app.use(express.json());
app.use(cookieParser());

/* -------------------------------------------
 * Security headers
 * -----------------------------------------*/
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* -------------------------------------------
 * CORS allowlist (อ่านเพิ่มจาก ENV ได้)
 * -----------------------------------------*/
const defaultAllowOrigins = [
  "https://www.solink.network",
  "https://app.solink.network",
  "http://localhost:3000",
] as const;

const envAllow = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOW_ORIGINS = new Set<string>([...defaultAllowOrigins, ...envAllow]);

const corsOptions: CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // รองรับ curl/healthcheck
    if (ALLOW_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error("CORS blocked by server"));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

/* -------------------------------------------
 * Rate limiting (เบื้องต้น)
 * -----------------------------------------*/
const commonLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(commonLimiter);

/* -------------------------------------------
 * Public routes (ไม่ต้อง auth)
 *  - /api/health
 *  - /api/auth/check (ตรวจ JWT)
 * -----------------------------------------*/
const publicRouter = express.Router();
mountHealth(publicRouter);

publicRouter.get("/auth/check", (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");
    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
      return res
        .status(401)
        .json({ ok: false, error: "Missing or invalid token format" });
    }

    const secret = process.env.JWT_SECRET || "";
    if (!secret) {
      return res
        .status(500)
        .json({ ok: false, error: "JWT secret is not configured" });
    }

    const payload = jwt.verify(token, secret);
    return res.status(200).json({ ok: true, user: payload });
  } catch (err: any) {
    return res
      .status(401)
      .json({ ok: false, error: err?.message ?? "Invalid token" });
  }
});

app.use("/api", publicRouter);

/* -------------------------------------------
 * Optional auth parser ใต้ /api
 * ไม่มี token ก็เข้าได้ แต่ endpoint ภายในจะเช็คเอง
 * -----------------------------------------*/
app.use("/api", authOptional);

/* -------------------------------------------
 * Feature routes (ต้องอยู่หลัง authOptional)
 * -----------------------------------------*/
const featureRouter = express.Router();
mountAuth(featureRouter);
mountSettings(featureRouter);
mountPoints(featureRouter); // ✅ เส้นทางแต้ม: /api/points/*
app.use("/api", featureRouter);

/* -------------------------------------------
 * 404 Handler
 * -----------------------------------------*/
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

/* -------------------------------------------
 * Error Handler (สุดท้าย)
 * -----------------------------------------*/
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  const msg =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err?.message || "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[ERROR]", err);
  }

  res.status(status).json({ ok: false, error: msg });
});

/* -------------------------------------------
 * Start server
 * -----------------------------------------*/
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Solink API running on :${port}`);
});
