import { fetchBikes } from "./api.js";
import { loadFavorites, toggleFavorite, isFavorite } from "./storage.js";
import { ensureKakaoLoaded, createMap, panTo, createMarkerImage } from "./map.js";

const els = {
  regionTabs: document.getElementById("regionTabs"),
  favList: document.getElementById("favList"),
  favEmpty: document.getElementById("favEmpty"),

  cardTitle: document.getElementById("cardTitle"),
  cardSub: document.getElementById("cardSub"),
  cardBikes: document.getElementById("cardBikes"),
  cardRatio: document.getElementById("cardRatio"),
  cardCongestion: document.getElementById("cardCongestion"),
  cardUsage: document.getElementById("cardUsage"),

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
};

let map = null;
let markers = [];

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
  if (ratio < 0.7) return { label: "보통", color: "#F59E0B" };
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
      selectStation(st.stationId, { pan: true });
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
  for (const st of appState.stations) {
    if (st.lat == null || st.lng == null) continue;

    const pos = new kakao.maps.LatLng(st.lat, st.lng);
    const img = createMarkerImage({
      color: st.congestion?.color || "#9CA3AF",
      level: st.congestion?.level || "unknown",
    });
    const marker = new kakao.maps.Marker({ position: pos, image: img });
    marker.setMap(map);

    kakao.maps.event.addListener(marker, "click", () => {
      selectStation(st.stationId, { pan: false });
    });

    markers.push(marker);
  }
}

function updateStatsUI() {
  els.regionStationCount.textContent = `${appState.currentRegion} 대여소 ${appState.stations.length}개`;
}

function rankingRatio(st) {
  if (Number(st.totalRack) > 0) return st.congestion?.ratio ?? 0;
  return fallbackRatioByAvailable(st) ?? 0;
}

function renderRanking() {
  const ranked = [...appState.stations]
    .map((s) => {
      const ratio = rankingRatio(s);
      const rental = Number(s.rentalCount) || 0;
      const score = rental * ratio;
      return { stationName: s.stationName, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

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
    li.innerHTML = `<span class="rankName">${idx + 1}. ${r.stationName}</span><span class="rankScore">${Math.round(r.score)}</span>`;
    els.rankList.appendChild(li);
  });
}

function updateCard(st) {
  if (!st) {
    els.cardTitle.textContent = "대여소를 선택하세요";
    els.cardSub.textContent = "마커를 누르면 상세 정보가 표시됩니다.";
    els.cardBikes.textContent = "-";
    els.cardRatio.textContent = "-";
    els.cardCongestion.textContent = "-";
    els.cardUsage.textContent = "-";
    els.favToggleBtn.disabled = true;
    els.favToggleIcon.textContent = "☆";
    return;
  }

  els.cardTitle.textContent = st.stationName;
  els.cardSub.textContent = st.region ? st.region : "지역 정보 없음";

  const hasRack = Number(st.totalRack) > 0;
  const fallbackRatio = fallbackRatioByAvailable(st);
  const displayRatio = hasRack ? st.congestion?.ratio : fallbackRatio;
  const displayLevel = hasRack
    ? { label: st.congestion?.label || "정보없음", color: st.congestion?.color || "#9CA3AF" }
    : ratioToLevel(fallbackRatio);

  els.cardBikes.textContent = `자전거 ${st.availableBike}대`;
  els.cardRatio.textContent = fmtPct(displayRatio);
  els.cardCongestion.textContent = hasRack ? displayLevel.label : `보정 ${displayLevel.label}`;
  els.cardCongestion.style.borderColor = displayLevel.color;
  els.cardCongestion.style.color = displayLevel.color;

  els.cardUsage.textContent = `대여 ${st.rentalCount}회 / 반납 ${st.returnCount}회`;

  els.favToggleBtn.disabled = false;
  els.favToggleIcon.textContent = isFavorite(appState.favorites, st.stationId) ? "★" : "☆";
}

function selectStation(stationId, { pan }) {
  appState.selectedStationId = stationId;
  const st = appState.stations.find((s) => s.stationId === stationId);
  updateCard(st);
  if (pan && st?.lat != null && st?.lng != null) {
    panTo(map, { lat: st.lat, lng: st.lng }, 4);
  }
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
        s.congestion?.level === "unknown"
          ? (fallbackRatioByAvailable(s) ?? 0)
          : (s.congestion?.ratio ?? 0);
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
  selectStation(best.stationId, { pan: true });
  return true;
}

function wireEvents() {
  els.favToggleBtn.addEventListener("click", () => {
    const st = appState.stations.find((s) => s.stationId === appState.selectedStationId);
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
      selectStation(best.stationId, { pan: true });
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
      selectStation(best.stationId, { pan: true });
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
    } catch (err) {
      alert(String(err?.message || err));
    }
  });
}

async function bootstrap() {
  await ensureKakaoLoaded();

  // 초기 지도 생성: 서울 중심(탭 클릭 시 이동)
  map = createMap(document.getElementById("map"), { lat: 37.5665, lng: 126.978 });

  // 초기 데이터 로드(백엔드가 regions도 내려줌)
  const init = await fetchBikes({ region: DEFAULT_REGION });
  appState.regions = init.regions || [];
  appState.stations = init.stations || [];
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

