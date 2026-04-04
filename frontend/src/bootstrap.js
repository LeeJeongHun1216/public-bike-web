import { fetchBikes } from "./api.js";
import { ensureKakaoLoaded, createMap } from "./map.js";
import { appState, DEFAULT_REGION } from "./appState.js";
import { mapRuntime } from "./mapRuntime.js";
import { initTheme } from "./theme.js";
import { hideInitialLoadOverlay } from "./initialOverlay.js";
import { renderTabs, setTabActive } from "./regionData.js";
import { renderMarkers } from "./mapMarkers.js";
import { renderFavorites } from "./favoritesView.js";
import { updateStatsUI, renderRanking } from "./rankingView.js";
import { updateCard } from "./stationCard.js";
import { wireEvents } from "./events.js";

export async function bootstrap() {
  initTheme();
  await ensureKakaoLoaded();

  mapRuntime.map = createMap(document.getElementById("map"), { lat: 37.5665, lng: 126.978 });

  const init = await fetchBikes({ region: DEFAULT_REGION });
  appState.regions = init.regions || [];
  appState.stations = init.stations || [];
  appState.maxAvailableBike = appState.stations.reduce(
    (m, s) => Math.max(m, Number(s.availableBike) || 0),
    0,
  );

  renderTabs();
  renderMarkers();
  renderFavorites();
  updateStatsUI();
  renderRanking();
  updateCard(null);
  wireEvents();

  setTabActive(DEFAULT_REGION);

  hideInitialLoadOverlay();
}
