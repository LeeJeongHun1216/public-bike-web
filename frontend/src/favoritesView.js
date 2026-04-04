import { els } from "./elements.js";
import { appState } from "./appState.js";
import { selectStation } from "./stationSelection.js";

export function renderFavorites() {
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
