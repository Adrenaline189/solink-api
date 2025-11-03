// src/index.ts
import express, { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

// Routes/Middleware ที่มีอยู่เดิม (ใช้แบบ mount function)
import mountAuth from "./routes/auth.js";
import mountSettings from "./routes/settings.js";
import mountHealth from "./routes/health.js";
import { authOptional } from "./middleware/auth.js";

/* -------------------------------------------
 * App bootstrap
 * -----------------------------------------*/
const app = express();
app.set("trust proxy", 1); // ให้ความร่วมมือกับ Render/Cloudflare เรื่อง IP/Header
app.use(express.json());

/* -------------------------------------------
 * Security headers
 * -----------------------------------------*/
app.use(
  helmet({
    // เปิดใช้ CORP แบบ cross-origin (จำเป็นกับ asset บางกรณี)
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // เปิดตัวเลือกอื่นตามที่ helmet กำหนดไว้ (ค่า default = ดี)
  })
);

/* -------------------------------------------
 * CORS allowlist (อ่านจาก ENV ได้ด้วย)
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
    if (!origin) return cb(null, true); // รองรับ curl / healthcheck
    if (ALLOW_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error("CORS blocked by server"));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

/* -------------------------------------------
 * Rate limiting
 * -----------------------------------------*/
const commonLimiter = rateLimit({
  windowMs: 60_000, // 1 นาที
  max: 200, // 200 req / นาที / IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(commonLimiter);

// (ทางเลือก) จำกัดหนักขึ้นเฉพาะเส้นทาง auth (สมัคร/ล็อกอิน/รีเฟรชฯลฯ)
// app.use("/api/auth", rateLimit({ windowMs: 60_000, max: 60 }));

/* -------------------------------------------
 * Public routes (ไม่ต้อง auth)
 * - health
 * - auth/check (ตรวจสอบความถูกต้องของ JWT ที่ client แนบมา)
 * -----------------------------------------*/
const publicRouter = express.Router();
mountHealth(publicRouter);

// ✅ ตรวจสอบ JWT token ที่แนบมาใน Authorization: Bearer <token>
publicRouter.get("/auth/check", (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
      return res.status(401).json({ ok: false, error: "Missing or invalid token format" });
    }

    const secret = process.env.JWT_SECRET || "";
    if (!secret) {
      // ถ้าไม่ได้ตั้งค่า secret ถือว่าเป็น misconfiguration
      return res.status(500).json({ ok: false, error: "JWT secret is not configured" });
    }

    const payload = jwt.verify(token, secret);
    return res.status(200).json({ ok: true, user: payload });
  } catch (err: any) {
    return res.status(401).json({ ok: false, error: err?.message ?? "Invalid token" });
  }
});

app.use("/api", publicRouter);

/* -------------------------------------------
 * Protected (optional) routes
 *  - ใต้ /api จะมี authOptional ซึ่งจะ parse user ถ้ามี token
 *    (ไม่มี token ก็เข้าได้ แต่บาง endpoint ภายในอาจเช็คเอง)
 * -----------------------------------------*/
app.use("/api", authOptional);

/* -------------------------------------------
 * Feature routes (mount เป็นกลุ่ม)
 * - /api/auth
 * - /api/settings
 * -----------------------------------------*/
const featureRouter = express.Router();
mountAuth(featureRouter);
mountSettings(featureRouter);
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
  // ซ่อนรายละเอียด error ใน production
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
