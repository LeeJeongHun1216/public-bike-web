import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, extractRows, extractTotalCount, withServiceKey } from "../lib/dataGoKr.js";
import { normalizeStationRow, normalizeStockRow, normalizeUsageRow } from "../lib/normalize.js";
import { calcCongestion } from "../lib/ratio.js";
import { REGIONS } from "../regions.js";
import { resolveRegionUrls } from "./apiMap.js";
import { calcRentalAvailabilityPoisson } from "../lib/poissonAvailability.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readMockJson(fileName) {
  const p = path.join(__dirname, "..", "mocks", fileName);
  const txt = await fs.readFile(p, "utf-8");
  return JSON.parse(txt);
}

async function fetchAllPages(client, { url, extraParams }) {
  // 페이지당 응답량이 너무 커서 타임아웃이 나는 경우가 있어 numOfRows를 낮춥니다.
  // (5000은 INVALID 케이스가 있어 안전하게 500 이하로 유지)
  const numOfRows = 500;
  const maxPages = 20; // 안전장치 (1000*20=20000)
  const maxRetries = 1; // timeout/네트워크 transient 오류 1회 재시도

  const out = [];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isTimeoutLike = (err) =>
    err?.code === "ECONNABORTED" ||
    err?.message?.toLowerCase?.().includes("timeout") ||
    err?.message?.toLowerCase?.().includes("timed out");

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    let res = null;
    // 특정 페이지가 느리게 응답하는 경우가 있어, timeout일 때만 1회 재시도합니다.
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        res = await client.get(url, {
          params: withServiceKey({ pageNo, numOfRows, type: "json", ...(extraParams || {}) }),
        });
        break;
      } catch (err) {
        if (attempt >= maxRetries || !isTimeoutLike(err)) throw err;
        const backoffMs = 500 * (attempt + 1);
        // eslint-disable-next-line no-console
        console.warn(`OpenAPI timeout detected. Retrying (pageNo=${pageNo}, attempt=${attempt + 1})...`);
        await sleep(backoffMs);
      }
    }
    const rows = extractRows(res);
    const totalCount = extractTotalCount(res);

    out.push(...rows);

    // 종료 조건: 더 이상 데이터 없음 / totalCount를 채웠음
    if (!rows.length) break;
    if (typeof totalCount === "number" && out.length >= totalCount) break;
    if (rows.length < numOfRows) break;
  }

  return out;
}

async function fetchStations(client, { stationsUrl, stationsParams }) {
  if (process.env.USE_MOCK === "true") return readMockJson("stations.json");

  const url = stationsUrl;
  if (!url) throw new Error("API_STATIONS_URL is missing");

  return fetchAllPages(client, { url, extraParams: stationsParams });
}

async function fetchStock(client, { stockUrl, stockParams }) {
  if (process.env.USE_MOCK === "true") return readMockJson("stock.json");

  const url = stockUrl;
  if (!url) return [];

  return fetchAllPages(client, { url, extraParams: stockParams });
}

async function fetchUsage(client, { usageUrl, usageParams }) {
  if (process.env.USE_MOCK === "true") return readMockJson("usage.json");

  const url = usageUrl;
  if (!url) return [];

  return fetchAllPages(client, { url, extraParams: usageParams });
}

function keyOf({ stationId, stationName }) {
  return (stationId || stationName || "").trim().toLowerCase();
}

function regionExists(regionKey) {
  return REGIONS.some((r) => r.key === regionKey);
}

function buildUsageDateParams({ startDate, endDate }) {
  if (!startDate || !endDate) return {};
  // 초보자 포인트: 실제 파라미터 이름은 데이터셋 문서를 확인해야 합니다.
  // 기본값은 bgngYmd/endYmd로 두고, 필요하면 .env에서 변경할 수 있게 합니다.
  const startKey = process.env.USAGE_START_PARAM || "bgngYmd";
  const endKey = process.env.USAGE_END_PARAM || "endYmd";
  return { [startKey]: startDate, [endKey]: endDate };
}

export async function getIntegratedStations({ region, startDate, endDate, nowHour }) {
  const client = createClient();
  const urls = await resolveRegionUrls(region);
  const usageDateParams = buildUsageDateParams({ startDate, endDate });

  const parseYmdToUtc = (ymd) => {
    if (!ymd || typeof ymd !== "string" || !/^\d{8}$/.test(ymd)) return null;
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(4, 6));
    const d = Number(ymd.slice(6, 8));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  const countInclusiveDays = (s, e) => {
    const ds = parseYmdToUtc(s);
    const de = parseYmdToUtc(e);
    if (!ds || !de) return 1;
    const diff = de.getTime() - ds.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
    return Number.isFinite(days) && days > 0 ? days : 1;
  };

  const days = countInclusiveDays(startDate, endDate);
  const nowHourNum = nowHour == null ? null : Number(nowHour);

  const warnings = [];

  const safeFetch = async (label, fn) => {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`[bikeAggregator] ${label} fetch failed: ${msg}`);
      warnings.push(`${label} fetch failed: ${msg}`);
      return [];
    }
  };

  // Promise.all을 쓰면 3개 중 하나가 타임아웃/장애가 나도 전체가 실패합니다.
  // "가끔" 500이 뜨는 상황을 완화하기 위해 순차 + 부분 실패 허용으로 변경합니다.
  const stationsRaw = await safeFetch("stations", () => fetchStations(client, urls));
  const stockRaw = await safeFetch("stock", () => fetchStock(client, urls));
  const usageRaw = await safeFetch("usage", () =>
    fetchUsage(client, { ...urls, usageParams: { ...(urls.usageParams || {}), ...usageDateParams } }),
  );

  if (!urls.stockUrl) warnings.push("stockUrl(대여가능 현황정보) 미설정: availableBike/totalRack이 0으로 표시됩니다.");
  if (!urls.usageUrl) warnings.push("usageUrl(대여/반납 현황정보) 미설정: 대여/반납 통계가 0으로 표시됩니다.");
  if (urls.usageUrl && (!startDate || !endDate)) {
    warnings.push("usage(대여/반납 현황정보): startDate/endDate(YYYYMMDD) 미입력 시 결과가 비어있을 수 있습니다.");
  }

  const stations = stationsRaw.map(normalizeStationRow);
  const stock = stockRaw.map(normalizeStockRow);
  const usage = usageRaw.map(normalizeUsageRow);

  // 빠른 병합을 위해 Map 구성
  const stockMap = new Map(stock.map((s) => [String(s.stationKey).trim().toLowerCase(), s]));
  const usageMap = new Map(usage.map((u) => [String(u.stationKey).trim().toLowerCase(), u]));

  const integrated = stations.map((st) => {
    const k = keyOf(st);
    const s = stockMap.get(k);
    const u = usageMap.get(k);

    const availableBike = s?.availableBike ?? 0;
    const totalRack = s?.totalRack ?? 0;
    const rentalCount = u?.rentalCount ?? 0;
    const returnCount = u?.returnCount ?? 0;
    const congestion = calcCongestion(availableBike, totalRack);

    const availability = calcRentalAvailabilityPoisson({
      availableBike,
      rentalCount,
      returnCount,
      hourly: u?.hourly ?? null,
      nowHour: nowHourNum,
      days,
    });

    return {
      stationId: st.stationId,
      stationName: st.stationName,
      lat: st.lat,
      lng: st.lng,
      region: st.region,
      availableBike,
      totalRack,
      rentalCount,
      returnCount,
      hourly: u?.hourly ?? null,
      congestion,
      availability,
    };
  });

  const filtered =
    region && region.trim() && regionExists(region)
      ? integrated.filter((x) => x.region === region)
      : integrated;

  // 통계/차별화: 인기 TOP5 + 시간대 피크(가능하면)
  const topStations = [...filtered]
    .sort((a, b) => (b.rentalCount || 0) - (a.rentalCount || 0))
    .slice(0, 5)
    .map((s) => ({
      stationId: s.stationId,
      stationName: s.stationName,
      rentalCount: s.rentalCount,
      region: s.region,
    }));

  const hourlyAgg = {};
  for (const st of filtered) {
    if (!st.hourly) continue;
    for (const [hh, cnt] of Object.entries(st.hourly)) {
      const n = Number(cnt);
      if (!Number.isFinite(n)) continue;
      hourlyAgg[hh] = (hourlyAgg[hh] || 0) + n;
    }
  }
  const peakHour =
    Object.keys(hourlyAgg).length === 0
      ? null
      : Object.entries(hourlyAgg).sort((a, b) => b[1] - a[1])[0][0];

  return {
    region: region || null,
    count: filtered.length,
    stations: filtered,
    warnings,
    stats: {
      topStations,
      peakHour,
      hourlyAgg: Object.keys(hourlyAgg).length ? hourlyAgg : null,
    },
  };
}

