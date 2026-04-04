import { els } from "./elements.js";
import { appState } from "./appState.js";
import { selectStation } from "./stationSelection.js";
import { rankingRatio } from "./rankingView.js";
import { fallbackRatioByAvailable } from "./congestion.js";

export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const q = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

export function getUserLocation() {
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

export function pickBestStation({ user, mode }) {
  const candidates = appState.stations
    .filter((s) => s.lat != null && s.lng != null && (s.availableBike > 0 || s.totalRack > 0))
    .map((s) => {
      const ratio =
        s.congestion?.level === "unknown" ? (fallbackRatioByAvailable(s) ?? 0) : (s.congestion?.ratio ?? 0);
      const dist = haversineKm(user, { lat: s.lat, lng: s.lng });
      const score =
        mode === "rent"
          ? ratio * 0.7 + (1 / (1 + dist)) * 0.3
          : (1 - ratio) * 0.7 + (1 / (1 + dist)) * 0.3;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.s || null;
}

export function pickBestFromMatches(matches, mode) {
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

export function searchAndSelect(mode) {
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
