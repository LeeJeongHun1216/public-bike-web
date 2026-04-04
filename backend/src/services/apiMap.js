import fs from "node:fs/promises";
import path from "node:path";

/** 지역별 URL은 `apiMap.json`(예: `apiMap.example.json` 참고); 없으면 `.env`의 API_*_URL 사용 */

const API_MAP_PATH = path.join(process.cwd(), "apiMap.json");

let cached = null;

export async function loadApiMap() {
  if (cached) return cached;

  try {
    const txt = await fs.readFile(API_MAP_PATH, "utf-8");
    cached = JSON.parse(txt);
    return cached;
  } catch {
    cached = {};
    return cached;
  }
}

export async function resolveRegionUrls(region) {
  const map = await loadApiMap();
  const entry = region ? map?.[region] : null;

  // fallback: 기존 .env 방식(전국 공통 URL 3개)
  const fallback = {
    stationsUrl: process.env.API_STATIONS_URL || "",
    stockUrl: process.env.API_STOCK_URL || "",
    usageUrl: process.env.API_USAGE_URL || "",
    stationsParams: {},
    stockParams: {},
    usageParams: {},
  };

  const resolved = entry || fallback;
  return {
    stationsUrl: resolved.stationsUrl || fallback.stationsUrl,
    stockUrl: resolved.stockUrl || fallback.stockUrl,
    usageUrl: resolved.usageUrl || fallback.usageUrl,
    stationsParams: resolved.stationsParams || fallback.stationsParams,
    stockParams: resolved.stockParams || fallback.stockParams,
    usageParams: resolved.usageParams || fallback.usageParams,
  };
}

