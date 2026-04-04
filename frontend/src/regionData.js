import { fetchBikes } from "./api.js";
import { els } from "./elements.js";
import { appState } from "./appState.js";
import { mapRuntime } from "./mapRuntime.js";
import { panTo } from "./map.js";
import { updateCard, updateCardDateApplyLoading } from "./stationCard.js";
import { stationAtCurrentSelection } from "./stationSelection.js";
import { renderMarkers } from "./mapMarkers.js";
import { renderFavorites } from "./favoritesView.js";
import { updateStatsUI, renderRanking } from "./rankingView.js";

export function setTabActive(regionKey) {
  [...els.regionTabs.querySelectorAll(".tab")].forEach((btn) => {
    btn.classList.toggle("isActive", btn.dataset.key === regionKey);
  });
}

export function renderTabs() {
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

export async function loadRegion(regionKey, options = {}) {
  const { dateApplyLoading = false } = options;
  appState.currentRegion = regionKey;
  setTabActive(regionKey);
  if (dateApplyLoading && stationAtCurrentSelection()) {
    updateCardDateApplyLoading();
  } else {
    updateCard(null);
  }

  const data = await fetchBikes({ region: regionKey });
  appState.regions = data.regions || [];
  appState.stations = data.stations || [];
  appState.maxAvailableBike = appState.stations.reduce(
    (m, s) => Math.max(m, Number(s.availableBike) || 0),
    0,
  );

  const regionMeta = appState.regions.find((r) => r.key === regionKey);
  if (regionMeta && mapRuntime.map) {
    panTo(mapRuntime.map, regionMeta.center, 6);
  }

  renderMarkers();
  renderFavorites();
  updateStatsUI();
  renderRanking();
}

export async function onRegionClick(regionKey) {
  try {
    await loadRegion(regionKey);
  } catch (e) {
    alert(String(e?.message || e));
  }
}
