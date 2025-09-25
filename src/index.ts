import express from "express";
import rateLimit from "express-rate-limit";
import { mountHealth } from "./routes/health.js";     // สำคัญ: ESM ต้อง .js
import { mountSettings } from "./routes/settings.js"; // <- ต้องเรียกใช้จริง

const app = express();

app.set("trust proxy", 1); // อยู่หลัง Cloudflare/Render เพื่อให้ rate-limit ใช้ IP จริง
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// mount routes
mountHealth(app);
mountSettings(app); // <- ตัวนี้แหละที่หายไป

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Solink API running on :${port}`));
