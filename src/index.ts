import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import healthRouter from "./routes/health";
import settingsRouter from "./routes/settings";

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json());

// Allow local + production domains
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://solink.network",
      "https://app-solink.network",
    ],
    credentials: false,
  })
);

// Rate limiting (100 req / minute per IP)
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

// Routes
app.use("/api/health", healthRouter);
app.use("/api/settings", settingsRouter);

// Root route
app.get("/", (_req, res) => res.json({ message: "Solink API running 🚀" }));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Solink API listening on port ${PORT}`);
});
