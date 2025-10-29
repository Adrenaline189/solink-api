import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
app.use(express.json());

// ✅ ปลอดภัยขึ้นด้วย helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ✅ ระบุ origin ที่อนุญาต
const ALLOW_ORIGINS = [
  "https://www.solink.network",
  "https://app.solink.network",
  "http://localhost:3000",
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked by server"));
    },
    credentials: true,
  })
);

// ✅ Rate Limit ป้องกัน spam
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// ✅ JWT Middleware
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!);
      (req as any).user = payload; // ใส่ user เข้า req
    } catch {
      console.warn("Invalid token");
    }
  }
  next();
});

// ✅ health route
app.get("/api/health", (_, res) => res.json({ ok: true, service: "api" }));

// ✅ db health route (mock หรือของจริงก็ได้)
app.get("/api/health/db", (_, res) =>
  res.json({ db: "up", via: "pooled", host: process.env.DATABASE_POOL_URL })
);

// ✅ settings route ตัวอย่าง
app.get("/api/settings", (req, res) => {
  const user = (req as any).user;
  if (user) {
    return res.json({
      ok: true,
      settings: { lang: "th", theme: "dark" },
      source: "db",
      userId: user.sub,
    });
  }
  return res.json({
    ok: true,
    settings: { lang: "th", theme: "light" },
    source: "db",
    userId: null,
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Solink API running on :${port}`));
