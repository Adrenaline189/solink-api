import express from "express";
import rateLimit from "express-rate-limit";
import { mountHealth } from "./routes/health.js";

const app = express();

app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 200, standardHeaders: true, legacyHeaders: false }));

mountHealth(app);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Solink API running on :${port}`));
