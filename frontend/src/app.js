import { fetchBikes } from "./api.js";
import { loadFavorites, toggleFavorite, isFavorite } from "./storage.js";
import { ensureKakaoLoaded, createMap, panTo, createMarkerImage } from "./map.js";

const THEME_KEY = "bikeMapTheme";

const els = {
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  regionTabs: document.getElementById("regionTabs"),
  favList: document.getElementById("favList"),
  favEmpty: document.getElementById("favEmpty"),

  cardTitle: document.getElementById("cardTitle"),
  cardSub: document.getElementById("cardSub"),
  cardBikes: document.getElementById("cardBikes"),
  cardRatio: document.getElementById("cardRatio"),
  cardCongestion: document.getElementById("cardCongestion"),
  cardUsage: document.getElementById("cardUsage"),
  stationDetailBlock: document.getElementById("stationDetailBlock"),
  stationDetailList: document.getElementById("stationDetailList"),

  favToggleBtn: document.getElementById("favToggleBtn"),
  favToggleIcon: document.getElementById("favToggleIcon"),

  regionStationCount: document.getElementById("regionStationCount"),
  rankList: document.getElementById("rankList"),

  findStationBtn: document.getElementById("findStationBtn"),
  findReturnBtn: document.getElementById("findReturnBtn"),
  stationSearchInput: document.getElementById("stationSearchInput"),
  searchClearBtn: document.getElementById("searchClearBtn"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  applyDateBtn: document.getElementById("applyDateBtn"),
};

const DEFAULT_REGION = "서울";

/** 백엔드 stationDetail 키와 동일 순서(공공데이터 대여소 정보) */
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
const STATION_DETAIL_OX_KEYS = new Set(["rpfactInstlYn", "arinjcInstlYn"]);

/** 공공데이터 HHMMSS(또는 숫자) → 오전/오후 + 시(2자리) */
function formatOperHour(raw) {
  if (raw == null || raw === "") return "-";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits.length) return String(raw).trim() || "-";
  const padded = digits.padStart(6, "0").slice(0, 6);
  const h24 = Number(padded.slice(0, 2));
  if (!Number.isFinite(h24) || h24 > 23) return String(raw).trim();

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
  return `${period} ${hh}시`;
}

function formatInstallOX(v) {
  if (v == null || String(v).trim() === "") return "-";
  const u = String(v).trim().toUpperCase();
  if (u === "Y" || u === "1" || u === "O" || u === "YES" || u === "예") return "O";
  if (u === "N" || u === "0" || u === "X" || u === "NO" || u === "아니오") return "X";
  return "-";
}

function renderStationDetail(detail) {
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
    let display = "-";
    if (!empty) {
      if (STATION_DETAIL_TIME_KEYS.has(key)) display = formatOperHour(raw);
      else if (STATION_DETAIL_OX_KEYS.has(key)) display = formatInstallOX(raw);
      else display = String(raw).trim();
    }
    parts.push(
      `<div class="detailRow"><span class="detailRow__k">${escapeHtml(label)}</span><span class="detailRow__v">${escapeHtml(display)}</span></div>`,
    );
  }
  list.innerHTML = parts.join("");
  block.hidden = false;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// 초보자 포인트: 날짜 필터를 전역에 저장해 API 쿼리에 반영합니다.
window.APP_STATE = window.APP_STATE || { startDate: "", endDate: "" };

let appState = {
  regions: [],
  currentRegion: DEFAULT_REGION,
  stations: [],
  maxAvailableBike: 0,
  stats: null,
  source: "-",
  favorites: loadFavorites(),
  selectedStationId: null,
  /** 동일 stationId가 여러 건일 때 마커 클릭으로 정확한 행을 가리키기 위한 목록 인덱스 */
  selectedStationListIndex: null,
};

let map = null;
let markers = [];

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch {
    /* ignore */
  }
  const icon = els.themeToggleBtn?.querySelector(".themeToggle__icon");
  if (els.themeToggleBtn) {
    els.themeToggleBtn.setAttribute(
      "aria-label",
      isDark ? "라이트 모드로 전환" : "다크 모드로 전환",
    );
  }
  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
}

function initTheme() {
  applyTheme(getStoredTheme());
  els.themeToggleBtn?.addEventListener("click", () => {
    applyTheme(getStoredTheme() === "dark" ? "light" : "dark");
  });
}

function fmtPct(ratio) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return "-";
  const n = Math.round((ratio || 0) * 100);
  return `${n}%`;
}

function fallbackRatioByAvailable(st) {
  const maxAvail = appState.maxAvailableBike || 0;
  if (maxAvail <= 0) return null;
  const r = (st.availableBike || 0) / maxAvail;
  return Math.max(0, Math.min(1, r));
}

function ratioToLevel(ratio) {
  if (ratio == null) return { label: "정보없음", color: "#9CA3AF" };
  if (ratio < 0.3) return { label: "부족", color: "#EF4444" };
  if (ratio < 0.7) return { label: "보통", color: "#F97316" };
  return { label: "여유", color: "#22C55E" };
}

function setTabActive(regionKey) {
  [...els.regionTabs.querySelectorAll(".tab")].forEach((btn) => {
    btn.classList.toggle("isActive", btn.dataset.key === regionKey);
  });
}

function renderTabs() {
  els.regionTabs.innerHTML = "";
  for (const r of appState.regions) {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.type = "button";
    btn.textContent = r.label;
    btn.dataset.key = r.key;
    btn.addEventListener("click", () => onRegionClick(r.key));
    els.regionTabs.appendChild(btn);
  }
  setTabActive(appState.currentRegion);
}

function renderFavorites() {
  const favStations = appState.favorites
    .map((id) => appState.stations.find((s) => s.stationId === id))
    .filter(Boolean);

  els.favList.innerHTML = "";
  if (!favStations.length) {
    els.favEmpty.style.display = "block";
    return;
  }
  els.favEmpty.style.display = "none";

  for (const st of favStations) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "favItemBtn";
    btn.textContent = st.stationName;
    btn.addEventListener("click", () => {
      const lix = appState.stations.indexOf(st);
      selectStation(st.stationId, { pan: true, listIndex: lix >= 0 ? lix : undefined });
    });
    li.appendChild(btn);
    els.favList.appendChild(li);
  }
}

function clearMarkers() {
  for (const m of markers) m.setMap(null);
  markers = [];
}

function renderMarkers() {
  clearMarkers();
  for (let idx = 0; idx < appState.stations.length; idx++) {
    const st = appState.stations[idx];
    if (st.lat == null || st.lng == null) continue;

    const pos = new kakao.maps.LatLng(st.lat, st.lng);
    const hasRack = Number(st.totalRack) > 0;

    let color = "#9CA3AF";

    if (hasRack) {
      // 혼잡도는 (availableBike / totalRack) 기준
      color = st.congestion?.color || "#9CA3AF";
    } else {
      // 거치대 정보가 없는 지자체는 해당 지역 max 기준으로 보정
      const fallbackRatio = fallbackRatioByAvailable(st);
      if (fallbackRatio != null && Number.isFinite(fallbackRatio)) {
        color = ratioToLevel(fallbackRatio).color;
      }
    }

    const img = createMarkerImage({ color });
    const marker = new kakao.maps.Marker({ position: pos, image: img });
    marker.setMap(map);

    kakao.maps.event.addListener(marker, "click", () => {
      selectStation(st.stationId, { pan: false, listIndex: idx });
    });

    markers.push(marker);
  }
}

function updateStatsUI() {
  els.regionStationCount.textContent = `${appState.currentRegion} 대여소 ${appState.stations.length}개`;
}

function rankingRatio(st) {
  if (st.availability?.prob != null && Number.isFinite(Number(st.availability.prob))) return st.availability.prob;
  if (Number(st.totalRack) > 0) return st.congestion?.ratio ?? 0;
  return fallbackRatioByAvailable(st) ?? 0;
}

function renderRanking() {
  const ranked = [...appState.stations]
    .map((s) => {
      const bikeCount = Number(s.availableBike) || 0;
      return { stationId: s.stationId, stationName: s.stationName, bikeCount };
    })
    .sort((a, b) => b.bikeCount - a.bikeCount)
    .slice(0, 10);

  els.rankList.innerHTML = "";
  if (!ranked.length) {
    const li = document.createElement("li");
    li.className = "rankItem";
    li.innerHTML = `<span class="rankName">데이터 없음</span><span class="rankScore">-</span>`;
    els.rankList.appendChild(li);
    return;
  }

  ranked.forEach((r, idx) => {
    const li = document.createElement("li");
    li.className = "rankItem";
    li.innerHTML = `<span class="rankName">${idx + 1}. ${r.stationName}</span>`;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => {
      const stHit = appState.stations.find((s) => String(s.stationId) === String(r.stationId));
      const lix = stHit != null ? appState.stations.indexOf(stHit) : -1;
      selectStation(r.stationId, { pan: true, listIndex: lix >= 0 ? lix : undefined });
    });
    els.rankList.appendChild(li);
  });
}

function updateCard(st) {
  if (!st) {
    appState.selectedStationListIndex = null;
    appState.selectedStationId = null;
    els.cardTitle.textContent = "대여소를 선택하세요";
    els.cardSub.textContent = "마커를 누르면 상세 정보가 표시됩니다.";
    els.cardBikes.textContent = "-";
    els.cardRatio.textContent = "-";
    els.cardCongestion.textContent = "-";
    els.cardUsage.textContent = "-";
    renderStationDetail(null);
    els.favToggleBtn.disabled = true;
    els.favToggleIcon.textContent = "☆";
    return;
  }

  els.cardTitle.textContent = st.stationName;
  els.cardSub.textContent = st.region ? st.region : "지역 정보 없음";

  const hasPoisson =
    st.availability?.prob != null && Number.isFinite(Number(st.availability.prob));
  const hasRack = Number(st.totalRack) > 0;
  const fallbackRatio = fallbackRatioByAvailable(st);

  const displayRatio = hasPoisson
    ? st.availability?.prob
    : hasRack
      ? st.congestion?.ratio
      : fallbackRatio;

  const displayLevel = ratioToLevel(displayRatio);

  els.cardBikes.textContent = `자전거 ${st.availableBike}대`;
  els.cardRatio.textContent = fmtPct(displayRatio);
  els.cardCongestion.style.borderColor = displayLevel.color;
  els.cardCongestion.style.color = displayLevel.color;
  // "보정여유/보정보통/보정부족" 같은 접두어 없이 통일해서 표시
  els.cardCongestion.textContent = displayLevel.label;

  els.cardUsage.textContent = `대여 ${st.rentalCount}회 / 반납 ${st.returnCount}회`;

  renderStationDetail(st.stationDetail ?? {});

  els.favToggleBtn.disabled = false;
  els.favToggleIcon.textContent = isFavorite(appState.favorites, st.stationId) ? "★" : "☆";
}

function selectStation(stationId, options = {}) {
  const pan = options.pan === true;
  const listIndex = options.listIndex;

  let st = null;
  if (typeof listIndex === "number" && listIndex >= 0 && listIndex < appState.stations.length) {
    st = appState.stations[listIndex];
    appState.selectedStationListIndex = listIndex;
  } else {
    appState.selectedStationListIndex = null;
    if (stationId != null && stationId !== "") {
      st = appState.stations.find((s) => String(s.stationId) === String(stationId));
    }
  }

  if (st) {
    appState.selectedStationId = st.stationId;
  } else {
    appState.selectedStationId = stationId ?? null;
  }

  updateCard(st);

  if (pan && st?.lat != null && st?.lng != null) {
    panTo(map, { lat: st.lat, lng: st.lng }, 4);
  }
}

function stationAtCurrentSelection() {
  const idx = appState.selectedStationListIndex;
  if (typeof idx === "number" && idx >= 0 && idx < appState.stations.length) {
    return appState.stations[idx];
  }
  return appState.stations.find((s) => String(s.stationId) === String(appState.selectedStationId));
}

async function loadRegion(regionKey) {
  appState.currentRegion = regionKey;
  setTabActive(regionKey);
  updateCard(null);

  const data = await fetchBikes({ region: regionKey });
  appState.regions = data.regions || [];
  appState.stations = data.stations || [];
  appState.maxAvailableBike = appState.stations.reduce(
    (m, s) => Math.max(m, Number(s.availableBike) || 0),
    0,
  );
  appState.stats = data.stats || null;
  appState.source = data.source || "-";

  const regionMeta = appState.regions.find((r) => r.key === regionKey);
  if (regionMeta) panTo(map, regionMeta.center, 6);

  renderMarkers();
  renderFavorites();
  updateStatsUI();
  renderRanking();
}

async function onRegionClick(regionKey) {
  try {
    await loadRegion(regionKey);
  } catch (e) {
    alert(String(e?.message || e));
  }
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const q = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("이 브라우저는 위치 정보를 지원하지 않습니다."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "위치 권한이 필요합니다.")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

function pickBestStation({ user, mode }) {
  // mode:
  // - "rent": 자전거가 많은 곳(여유) + 가까운 곳
  // - "return": 거치대가 넉넉한 곳(= availableBike가 적을수록) + 가까운 곳
  const candidates = appState.stations
    .filter((s) => s.lat != null && s.lng != null && (s.availableBike > 0 || s.totalRack > 0))
    .map((s) => {
      // totalRack이 없는 지자체는 지역 내 availableBike 상대비율로 보정합니다.
      const ratio =
        s.congestion?.level === "unknown" ? (fallbackRatioByAvailable(s) ?? 0) : (s.congestion?.ratio ?? 0);
      const dist = haversineKm(user, { lat: s.lat, lng: s.lng });
      const score =
        mode === "rent"
          ? ratio * 0.7 + (1 / (1 + dist)) * 0.3
          : (1 - ratio) * 0.7 + (1 / (1 + dist)) * 0.3;
      return { s, dist, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.s || null;
}

function pickBestFromMatches(matches, mode) {
  const ranked = [...matches]
    .map((s) => {
      const ratio = rankingRatio(s) ?? 0;
      const rental = Number(s.rentalCount) || 0;
      return { s, ratio, rental };
    })
    .sort((a, b) => {
      if (mode === "rent") {
        if (b.ratio !== a.ratio) return b.ratio - a.ratio;
        return b.rental - a.rental;
      }
      if (a.ratio !== b.ratio) return a.ratio - b.ratio;
      return b.rental - a.rental;
    });
  return ranked[0]?.s || null;
}

function searchAndSelect(mode) {
  const keyword = (els.stationSearchInput?.value || "").trim().toLowerCase();
  if (!keyword) return false;

  const matches = appState.stations.filter((s) =>
    String(s.stationName || "").toLowerCase().includes(keyword),
  );
  if (!matches.length) {
    alert("검색 결과가 없습니다.");
    return true;
  }

  const best = pickBestFromMatches(matches, mode);
  if (!best) {
    alert("검색 결과가 없습니다.");
    return true;
  }
  const lix = appState.stations.indexOf(best);
  selectStation(best.stationId, { pan: true, listIndex: lix >= 0 ? lix : undefined });
  return true;
}

function wireEvents() {
  els.favToggleBtn.addEventListener("click", () => {
    const st = stationAtCurrentSelection();
    if (!st) return;
    appState.favorites = toggleFavorite(appState.favorites, st.stationId);
    els.favToggleIcon.textContent = isFavorite(appState.favorites, st.stationId) ? "★" : "☆";
    renderFavorites();
  });

  els.findStationBtn.addEventListener("click", async () => {
    if (searchAndSelect("rent")) return;
    try {
      const user = await getUserLocation();
      const best = pickBestStation({ user, mode: "rent" });
      if (!best) return alert("추천할 대여소가 없습니다.");
      const lix = appState.stations.indexOf(best);
      selectStation(best.stationId, { pan: true, listIndex: lix >= 0 ? lix : undefined });
    } catch (e) {
      alert(String(e?.message || e));
    }
  });

  els.findReturnBtn.addEventListener("click", async () => {
    if (searchAndSelect("return")) return;
    try {
      const user = await getUserLocation();
      const best = pickBestStation({ user, mode: "return" });
      if (!best) return alert("추천할 반납 대여소가 없습니다.");
      const lix = appState.stations.indexOf(best);
      selectStation(best.stationId, { pan: true, listIndex: lix >= 0 ? lix : undefined });
    } catch (e) {
      alert(String(e?.message || e));
    }
  });

  els.searchClearBtn?.addEventListener("click", () => {
    if (els.stationSearchInput) els.stationSearchInput.value = "";
    els.stationSearchInput?.focus();
  });

  els.stationSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchAndSelect("rent");
    }
  });

  els.applyDateBtn?.addEventListener("click", async () => {
    // 기간 적용으로 데이터가 다시 로딩되면 카드가 초기화되므로,
    // 기존에 선택된 대여소가 있으면 동일 ID의 대여소를 찾아 카드만 복원한다.
    const prevSelectedStationId = appState.selectedStationId;
    const prevListIndex = appState.selectedStationListIndex;

    // HTML date input: YYYY-MM-DD → API: YYYYMMDD
    const toYmd = (v) => (v ? v.replaceAll("-", "") : "");
    const s = toYmd(els.startDate?.value || "");
    const e = toYmd(els.endDate?.value || "");

    if ((s && !e) || (!s && e)) {
      alert("시작일자와 종료일자를 모두 입력하세요.");
      return;
    }
    if (s && e && s > e) {
      alert("시작일자는 종료일자보다 클 수 없습니다.");
      return;
    }

    window.APP_STATE.startDate = s;
    window.APP_STATE.endDate = e;

    try {
      await loadRegion(appState.currentRegion);
      if (typeof prevListIndex === "number" && prevListIndex >= 0 && prevListIndex < appState.stations.length) {
        const cand = appState.stations[prevListIndex];
        if (cand && String(cand.stationId) === String(prevSelectedStationId)) {
          selectStation(prevSelectedStationId, { pan: false, listIndex: prevListIndex });
        } else if (prevSelectedStationId) {
          const st = appState.stations.find((x) => String(x.stationId) === String(prevSelectedStationId));
          if (st) selectStation(prevSelectedStationId, { pan: false });
        }
      } else if (prevSelectedStationId) {
        const st = appState.stations.find((x) => String(x.stationId) === String(prevSelectedStationId));
        if (st) selectStation(prevSelectedStationId, { pan: false });
      }
    } catch (err) {
      alert(String(err?.message || err));
    }
  });
}

async function bootstrap() {
  initTheme();
  await ensureKakaoLoaded();

  // 초기 지도 생성: 서울 중심(탭 클릭 시 이동)
  map = createMap(document.getElementById("map"), { lat: 37.5665, lng: 126.978 });

  // 초기 데이터 로드(백엔드가 regions도 내려줌)
  const init = await fetchBikes({ region: DEFAULT_REGION });
  appState.regions = init.regions || [];
  appState.stations = init.stations || [];
  // 초기 접속에서도 '보정(대여가능확률)' 계산이 즉시 나오도록 maxAvailableBike 계산
  appState.maxAvailableBike = appState.stations.reduce(
    (m, s) => Math.max(m, Number(s.availableBike) || 0),
    0,
  );
  appState.stats = init.stats || null;
  appState.source = init.source || "-";

  renderTabs();
  renderMarkers();
  renderFavorites();
  updateStatsUI();
  renderRanking();
  updateCard(null);
  wireEvents();

  // 탭 UI는 init 이후에 활성 표시
  setTabActive(DEFAULT_REGION);
}

bootstrap().catch((e) => {
  alert(String(e?.message || e));
});

