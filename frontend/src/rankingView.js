import { els } from "./elements.js";
import { appState } from "./appState.js";
import { selectStation } from "./stationSelection.js";
import { fallbackRatioByAvailable } from "./congestion.js";

export function rankingRatio(st) {
  if (st.availability?.prob != null && Number.isFinite(Number(st.availability.prob))) {
    return st.availability.prob;
  }
  if (Number(st.totalRack) > 0) return st.congestion?.ratio ?? 0;
  return fallbackRatioByAvailable(st) ?? 0;
}

export function updateStatsUI() {
  els.regionStationCount.textContent = `${appState.currentRegion} 대여소 ${appState.stations.length}개`;
}

export function renderRanking() {
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
