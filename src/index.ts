import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import healthRouter from "./routes/health";
import settingsRouter from "./routes/settings";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"], credentials: false }));
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

app.use("/api/health", healthRouter);
app.use("/api/settings", settingsRouter);

app.get("/", (_req, res) => res.json({ message: "Solink API running 🚀" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Solink API listening on port ${PORT}`);
});