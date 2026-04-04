import { createMarkerImage } from "./map.js";
import { appState } from "./appState.js";
import { mapRuntime } from "./mapRuntime.js";
import { selectStation } from "./stationSelection.js";
import { fallbackRatioByAvailable, ratioToLevel } from "./congestion.js";

export function clearMarkers() {
  for (const m of mapRuntime.markers) m.setMap(null);
  mapRuntime.markers = [];
}

export function renderMarkers() {
  clearMarkers();
  const map = mapRuntime.map;
  if (!map) return;

  for (let idx = 0; idx < appState.stations.length; idx++) {
    const st = appState.stations[idx];
    if (st.lat == null || st.lng == null) continue;

    const pos = new kakao.maps.LatLng(st.lat, st.lng);
    const hasRack = Number(st.totalRack) > 0;

    let color = "#9CA3AF";

    if (hasRack) {
      color = st.congestion?.color || "#9CA3AF";
    } else {
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

    mapRuntime.markers.push(marker);
  }
}
