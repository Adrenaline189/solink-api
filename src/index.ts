import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import jwt, { JwtPayload } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import settingsRoutes from "./routes/settings";

const app = express();
app.use(express.json());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:"],
        "style-src": ["'self'", "https:", "'unsafe-inline'"],
        "script-src": ["'self'"]
      }
    }
  })
);

const ALLOW_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  "https://www.solink.network",
  "https://app.solink.network",
  "http://localhost:3000"
];

const ORIGINS = ALLOW_ORIGINS.length ? ALLOW_ORIGINS : DEFAULT_ORIGINS;

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked by server"));
    },
    credentials: true
  })
);

app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      req.user = { sub: String(payload.sub), iat: payload.iat, exp: payload.exp };
    } catch (err) {
      console.warn("Invalid token:", (err as Error).message);
    }
  }
  next();
});

app.get("/api/health", (_: Request, res: Response) => res.json({ ok: true, service: "api" }));

app.get("/api/health/db", (_: Request, res: Response) =>
  res.json({ db: "up", via: "pooled", host: process.env.DATABASE_POOL_URL })
);

app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`✅ Solink API running on :${port}`));
