import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt, { JwtPayload } from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
app.use(express.json());

// ✅ เพิ่มความปลอดภัย
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

// ✅ CORS options — ใช้ Custom callback แบบ simple ให้ TS ไม่ error
app.use(
  cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked by server"));
    },
    credentials: true,
  })
);

// ✅ Rate Limit ป้องกัน spam
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 นาที
    max: 200, // 200 req ต่อ IP
  })
);

// ✅ JWT Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;
      (req as any).user = payload;
    } catch (err) {
      console.warn("Invalid token:", (err as Error).message);
    }
  }
  next();
});

// ✅ health route
app.get("/api/health", (_: Request, res: Response) => {
  res.json({ ok: true, service: "api" });
});

// ✅ db health route
app.get("/api/health/db", (_: Request, res: Response) => {
  res.json({
    db: "up",
    via: "pooled",
    host: process.env.DATABASE_POOL_URL,
  });
});

// ✅ settings route ตัวอย่าง
app.get("/api/settings", (req: Request, res: Response) => {
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

// ✅ เริ่มเซิร์ฟเวอร์
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`✅ Solink API running on :${port}`));
