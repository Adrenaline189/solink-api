import express from "express";
import rateLimit from "express-rate-limit";

import { mountHealth } from "./routes/health.js";
import { mountSettings } from "./routes/settings.js"; // ✅ เพิ่มมา

const app = express();
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
mountSettings(app); // ✅ ต้องเรียกด้วย

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Solink API running on :${port}`));
