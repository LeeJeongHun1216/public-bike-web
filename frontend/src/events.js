import { appState } from "./appState.js";
import { els } from "./elements.js";
import { toggleFavorite, isFavorite } from "./storage.js";
import {
  selectStation,
  stationAtCurrentSelection,
  restoreStationSelection,
} from "./stationSelection.js";
import { updateCard } from "./stationCard.js";
import { renderFavorites } from "./favoritesView.js";
import { loadRegion } from "./regionData.js";
import {
  getUserLocation,
  pickBestStation,
  searchAndSelect,
} from "./recommend.js";
import { setStationDetailExpanded } from "./stationDetailView.js";

export function wireEvents() {
  els.stationDetailToggle?.addEventListener("click", () => {
    if (els.stationDetailBlock?.hidden) return;
    const expanded = els.stationDetailToggle.getAttribute("aria-expanded") === "true";
    const next = !expanded;
    appState.stationDetailExpanded = next;
    setStationDetailExpanded(next);
  });

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
    const prevSelectedStationId = appState.selectedStationId;
    const prevListIndex = appState.selectedStationListIndex;

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

    const dateApplyLoading =
      prevSelectedStationId != null && stationAtCurrentSelection() != null;

    try {
      await loadRegion(appState.currentRegion, { dateApplyLoading });
      restoreStationSelection(prevSelectedStationId, prevListIndex);
    } catch (err) {
      alert(String(err?.message || err));
      const st = stationAtCurrentSelection();
      if (st) updateCard(st);
      else updateCard(null);
    }
  });
}
