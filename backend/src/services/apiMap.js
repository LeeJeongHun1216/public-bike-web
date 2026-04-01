import fs from "node:fs/promises";
import path from "node:path";

// 초보자 포인트:
// 지역별 엔드포인트가 다를 때는 "매핑 파일"로 관리하는게 가장 편합니다.
// - backend/apiMap.json 파일을 만들고 (apiMap.example.json 참고)
// - 각 지역별로 stationsUrl/stockUrl/usageUrl 3개를 넣습니다.

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
    source: entry ? "apiMap" : "env",
  };
}

