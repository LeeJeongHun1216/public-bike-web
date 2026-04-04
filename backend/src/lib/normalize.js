// 공공데이터 API는 지자체/데이터셋마다 필드명이 다를 수 있습니다.
// 아래 함수는 "가능한 많은 케이스"를 흡수하려는 안전한 정규화 계층입니다.

import { regionKeyFromInstCd } from "../regions.js";

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function toStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 자치단체 공영자전거 대여소 정보(pbdo_v2 등) 부가 필드 — 카드 표시용 */
function pickDetailStr(row, keys) {
  const v = pick(row, Array.isArray(keys) ? keys : [keys]);
  const s = toStr(v);
  return s || null;
}

export function stationDetailFromRow(row) {
  if (!row || typeof row !== "object") return null;
  const detail = {
    operBgngHrCn: pickDetailStr(row, ["operBgngHrCn"]),
    operEndHrCn: pickDetailStr(row, ["operEndHrCn"]),
    rntstnOperDayoffDayCn: pickDetailStr(row, ["rntstnOperDayoffDayCn"]),
    rntstnFcltTypeNm: pickDetailStr(row, ["rntstnFcltTypeNm"]),
    rpfactInstlYn: pickDetailStr(row, ["rpfactInstlYn"]),
    arinjcInstlYn: pickDetailStr(row, ["arinjcInstlYn"]),
    rntFeeTypeNm: pickDetailStr(row, ["rntFeeTypeNm"]),
    mngInstNm: pickDetailStr(row, ["mngInstNm"]),
    mngInstTelno: pickDetailStr(row, ["mngInstTelno"]),
    bcyclDataCrtrYmd: pickDetailStr(row, ["bcyclDataCrtrYmd"]),
    lcgvmnInstNm: pickDetailStr(row, ["lcgvmnInstNm"]),
  };
  const hasAny = Object.values(detail).some((v) => v != null && v !== "");
  return hasAny ? detail : null;
}

export function normalizeStationRow(row) {
  const stationId = toStr(
    pick(row, [
      "stationId",
      "station_id",
      "대여소ID",
      "대여소id",
      "id",
      "ID",
      "rentStationId",
      "RENT_STATION_ID",
      // 공공데이터포털(자치단체 공영자전거 대여소 정보)
      "rntstnId",
    ]),
  );
  const stationName = toStr(
    pick(row, [
      "stationName",
      "station_name",
      "대여소명",
      "대여소이름",
      "name",
      "대여소",
      "RENT_STATION_NM",
      // 공공데이터포털(자치단체 공영자전거 대여소 정보)
      "rntstnNm",
    ]),
  );
  const lat = Number(
    pick(row, [
      "lat",
      "latitude",
      "위도",
      "LAT",
      "stationLatitude",
      "위도값",
      "y",
      "Y",
      "rntstnLa",
      "stnLa",
    ]),
  );
  const lng = Number(
    pick(row, [
      "lng",
      "lon",
      "longitude",
      "경도",
      "LNG",
      "LON",
      "stationLongitude",
      "경도값",
      "x",
      "X",
      // 공공데이터포털(자치단체 공영자전거 대여소 정보)에서 경도 필드가 lot로 내려오는 케이스
      "lot",
      "rntstnLo",
      "stnLo",
    ]),
  );
  const rawRegion = toStr(pick(row, ["region", "지역", "시도", "시군구", "city", "gu", "구", "sido", "lcgvmnInstNm"]));
  const instCd = toStr(pick(row, ["lcgvmnInstCd"]));

  // 탭 키(REGIONS[].key)와 동일한 문자열이어야 getIntegratedStations의 region 필터에 걸립니다.
  // 포털 응답의 lcgvmnInstNm은 "충청남도 공주시" 등이라 key("충남 공주시")와 불일치할 수 있으므로 instCd 우선.
  const fromCode = regionKeyFromInstCd(instCd);
  const region =
    fromCode ||
    rawRegion
      .replace("특별시", "")
      .replace("광역시", "")
      .replace("특별자치시", "")
      .trim();

  return {
    stationId: stationId || stationName, // ID가 없다면 이름을 대체키로 사용
    stationName: stationName || stationId || "이름없음",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    region,
    stationDetail: stationDetailFromRow(row),
    raw: row,
  };
}

export function normalizeStockRow(row) {
  const stationId = toStr(
    pick(row, [
      "stationId",
      "station_id",
      "대여소ID",
      "대여소id",
      "id",
      "rentStationId",
      "RENT_STATION_ID",
      // 공공데이터포털(대여가능 현황정보)
      "rntstnId",
    ]),
  );
  const stationName = toStr(
    pick(row, ["stationName", "station_name", "대여소명", "대여소이름", "name", "RENT_STATION_NM", "rntstnNm"]),
  );

  const availableBike = toNum(
    pick(row, [
      "availableBike",
      "available_bike",
      "대여가능자전거수",
      "대여가능자전거",
      "bike",
      "BIKE",
      "parkingBikeTotCnt",
      // 공공데이터포털(대여가능 현황정보)
      "bcyclTpkctNocs",
    ]),
  );
  // NOTE: pbdo_v2 현황정보에는 거치대(도크) 수가 없을 수 있어 fallback만 둡니다.
  const totalRack = toNum(
    pick(row, ["totalRack", "total_rack", "거치대수", "거치대", "rack", "RACK", "rackTotCnt"]),
  );

  return {
    stationKey: stationId || stationName,
    availableBike,
    totalRack,
    raw: row,
  };
}

export function normalizeUsageRow(row) {
  const stationId = toStr(
    pick(row, [
      "stationId",
      "station_id",
      "대여소ID",
      "대여소id",
      "id",
      "rentStationId",
      "RENT_STATION_ID",
      "rntstnId",
    ]),
  );
  const stationName = toStr(
    pick(row, [
      "stationName",
      "station_name",
      "대여소명",
      "대여소이름",
      "name",
      "RENT_STATION_NM",
      "rntstnNm",
    ]),
  );

  // 대여소별 대여/반납 현황 API: rntNocs(대여 가능 자전거 수), rtnNocs(반납 가능 거치대 수)
  const rentalCount = toNum(
    pick(row, [
      "rntNocs",
      "rentalCount",
      "rental_count",
      "대여횟수",
      "대여건수",
      "rentCnt",
      "RENT_CNT",
    ]),
  );
  const returnCount = toNum(
    pick(row, [
      "rtnNocs",
      "returnCount",
      "return_count",
      "반납횟수",
      "반납건수",
      "returnCnt",
      "RETURN_CNT",
    ]),
  );

  // 시간대별 이용 데이터(가능한 경우): 예) {"00": 12, "01": 3, ...}
  const hourly = pick(row, ["hourly", "시간대별", "hourlyUsage", "HOUR_CNT_MAP"]);

  return {
    stationKey: stationId || stationName,
    rentalCount,
    returnCount,
    hourly: hourly && typeof hourly === "object" ? hourly : null,
    raw: row,
  };
}

