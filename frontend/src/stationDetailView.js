import { els } from "./elements.js";
import { appState } from "./appState.js";

const DETAIL_EMPTY = "정보 없음";

const STATION_DETAIL_FIELDS = [
  { key: "operBgngHrCn", label: "운영 시작" },
  { key: "operEndHrCn", label: "운영 종료" },
  { key: "rntstnOperDayoffDayCn", label: "휴무일" },
  { key: "rntstnFcltTypeNm", label: "대여소 유형" },
  { key: "rpfactInstlYn", label: "수리시설 설치" },
  { key: "arinjcInstlYn", label: "공기주입기 설치" },
  { key: "rntFeeTypeNm", label: "요금 유형" },
  { key: "mngInstNm", label: "관리 기관" },
  { key: "mngInstTelno", label: "연락처" },
  { key: "bcyclDataCrtrYmd", label: "데이터 기준일" },
  { key: "lcgvmnInstNm", label: "지자체(행정명)" },
];

const STATION_DETAIL_TIME_KEYS = new Set(["operBgngHrCn", "operEndHrCn"]);
const STATION_DETAIL_DATE_KEYS = new Set(["bcyclDataCrtrYmd"]);
const STATION_DETAIL_OX_KEYS = new Set(["rpfactInstlYn", "arinjcInstlYn"]);

function formatDataBasisYmd(raw) {
  if (raw == null || String(raw).trim() === "") return DETAIL_EMPTY;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 8) {
    const y = digits.slice(0, 4);
    const mo = digits.slice(4, 6);
    const da = digits.slice(6, 8);
    return `${y}-${mo}-${da}`;
  }
  const t = String(raw).trim();
  return t || DETAIL_EMPTY;
}

function formatOperHour(raw) {
  if (raw == null || String(raw).trim() === "") return DETAIL_EMPTY;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits.length) return String(raw).trim() || DETAIL_EMPTY;

  const padded = digits.padStart(6, "0");
  const chunk = padded.length > 6 ? padded.slice(-6) : padded;

  let h24 = Number(chunk.slice(0, 2));
  let mm = Number(chunk.slice(2, 4));
  if (!Number.isFinite(h24)) return String(raw).trim() || DETAIL_EMPTY;
  if (!Number.isFinite(mm) || mm < 0 || mm > 59) mm = 0;

  if (h24 > 24) {
    h24 %= 24;
  }

  if (h24 === 24) {
    const mStr = String(mm).padStart(2, "0");
    return `오후 12시 ${mStr}분`;
  }

  let period;
  let hour12;
  if (h24 === 0) {
    period = "오전";
    hour12 = 0;
  } else if (h24 === 12) {
    period = "오후";
    hour12 = 12;
  } else if (h24 < 12) {
    period = "오전";
    hour12 = h24;
  } else {
    period = "오후";
    hour12 = h24 - 12;
  }
  const hh = String(hour12).padStart(2, "0");
  const mStr = String(mm).padStart(2, "0");
  return `${period} ${hh}시 ${mStr}분`;
}

function formatInstallOX(v) {
  if (v == null || String(v).trim() === "") return DETAIL_EMPTY;
  const u = String(v).trim().toUpperCase();
  if (u === "Y" || u === "1" || u === "O" || u === "YES" || u === "예") return "O";
  if (u === "N" || u === "0" || u === "X" || u === "NO" || u === "아니오") return "X";
  return DETAIL_EMPTY;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function setStationDetailExpanded(expanded) {
  const btn = els.stationDetailToggle;
  const list = els.stationDetailList;
  const block = els.stationDetailBlock;
  if (!btn || !list || !block || block.hidden) return;

  btn.setAttribute("aria-expanded", String(expanded));
  list.hidden = !expanded;

  const label = btn.querySelector(".detailToggleBtn__label");
  const icon = btn.querySelector(".detailToggleBtn__icon");
  if (label) label.textContent = expanded ? "접기" : "펼치기";
  if (icon) icon.textContent = expanded ? "▲" : "▼";
}

export function renderStationDetail(detail) {
  const block = els.stationDetailBlock;
  const list = els.stationDetailList;
  if (!block || !list) return;
  if (detail === null) {
    block.hidden = true;
    list.innerHTML = "";
    return;
  }
  const d = detail && typeof detail === "object" ? detail : {};
  const parts = [];
  for (const { key, label } of STATION_DETAIL_FIELDS) {
    const raw = d[key];
    const empty = raw == null || String(raw).trim() === "";
    let display = DETAIL_EMPTY;
    if (!empty) {
      if (STATION_DETAIL_TIME_KEYS.has(key)) display = formatOperHour(raw);
      else if (STATION_DETAIL_DATE_KEYS.has(key)) display = formatDataBasisYmd(raw);
      else if (STATION_DETAIL_OX_KEYS.has(key)) display = formatInstallOX(raw);
      else display = String(raw).trim() || DETAIL_EMPTY;
    }
    parts.push(
      `<div class="detailRow"><span class="detailRow__k">${escapeHtml(label)}</span><span class="detailRow__v">${escapeHtml(display)}</span></div>`,
    );
  }
  list.innerHTML = parts.join("");
  block.hidden = false;
  setStationDetailExpanded(appState.stationDetailExpanded);
}
