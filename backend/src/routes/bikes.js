import { Router } from "express";
import { z } from "zod";
import { getIntegratedStations } from "../services/bikeAggregator.js";
import { REGIONS } from "../regions.js";

export const bikesRouter = Router();

const querySchema = z.object({
  region: z.string().optional(),
  startDate: z.string().regex(/^\d{8}$/).optional(),
  endDate: z.string().regex(/^\d{8}$/).optional(),
  nowHour: z.coerce.number().int().min(0).max(23).optional(),
});

// GET /api/bikes?region=서울
bikesRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", detail: parsed.error.flatten() });
  }

  try {
    const region = parsed.data.region;
    const { startDate, endDate, nowHour } = parsed.data;
    const data = await getIntegratedStations({ region, startDate, endDate, nowHour });

    res.json({
      ...data,
      regions: REGIONS,
      source: process.env.USE_MOCK === "true" ? "mock" : "openapi",
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to build integrated data",
      message: err instanceof Error ? err.message : String(err),
      hint:
        process.env.USE_MOCK === "true"
          ? "mock 모드에서도 실패했다면 backend/src/mocks/*.json 형식을 확인하세요."
          : "실데이터 모드라면 .env의 DATA_GO_KR_SERVICE_KEY / API_*_URL 설정을 확인하세요.",
    });
  }
});

