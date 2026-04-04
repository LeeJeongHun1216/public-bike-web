import { appState } from "./appState.js";
import { panTo } from "./map.js";
import { mapRuntime } from "./mapRuntime.js";
import { updateCard } from "./stationCard.js";

export function selectStation(stationId, options = {}) {
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

  if (pan && st?.lat != null && st?.lng != null && mapRuntime.map) {
    panTo(mapRuntime.map, { lat: st.lat, lng: st.lng }, 4);
  }
}

export function stationAtCurrentSelection() {
  const idx = appState.selectedStationListIndex;
  if (typeof idx === "number" && idx >= 0 && idx < appState.stations.length) {
    return appState.stations[idx];
  }
  return appState.stations.find((s) => String(s.stationId) === String(appState.selectedStationId));
}

export function restoreStationSelection(prevSelectedStationId, prevListIndex) {
  if (prevSelectedStationId == null) return;
  if (
    typeof prevListIndex === "number" &&
    prevListIndex >= 0 &&
    prevListIndex < appState.stations.length
  ) {
    const cand = appState.stations[prevListIndex];
    if (cand && String(cand.stationId) === String(prevSelectedStationId)) {
      selectStation(prevSelectedStationId, { pan: false, listIndex: prevListIndex });
      return;
    }
  }
  const st = appState.stations.find((x) => String(x.stationId) === String(prevSelectedStationId));
  if (st) selectStation(prevSelectedStationId, { pan: false });
}
