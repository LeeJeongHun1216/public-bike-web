import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import { bikesRouter } from "./routes/bikes.js";
import { healthRouter } from "./routes/health.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
  }),
);
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/health", healthRouter);
app.use("/api/bikes", bikesRouter);

const port = Number(process.env.PORT || 5179);
app.listen(port, () => {
  console.log(`[backend] listening on http://127.0.0.1:${port}`);
});

