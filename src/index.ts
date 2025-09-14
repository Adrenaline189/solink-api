import "dotenv/config"; // โหลด env อัตโนมัติ
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import settingsRouter from "./routes/settings";
import healthRouter from "./routes/health";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// routes
app.use("/api/settings", settingsRouter);
app.use("/api/health", healthRouter);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Solink API running 🚀" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Solink API listening on port ${PORT}`);
});
