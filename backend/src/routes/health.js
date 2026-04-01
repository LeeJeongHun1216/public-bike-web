import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
  });
});

