import { els } from "./elements.js";
import { appState } from "./appState.js";
import { isFavorite } from "./storage.js";
import { renderStationDetail } from "./stationDetailView.js";
import { fmtPct, fallbackRatioByAvailable, ratioToLevel } from "./congestion.js";

export function fillCardStationMetrics(st) {
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
  els.cardCongestion.textContent = displayLevel.label;
}

export function updateCardDateApplyLoading() {
  els.cardTitle.textContent = "대여/반납 정보를 조회 중입니다.";
  els.cardSub.textContent = "";
  els.cardBikes.textContent = "-";
  els.cardRatio.textContent = "-";
  els.cardCongestion.textContent = "-";
  els.cardCongestion.style.borderColor = "";
  els.cardCongestion.style.color = "";
  els.cardUsage.textContent = "-";
  renderStationDetail(null);
  els.favToggleBtn.disabled = true;
  const sid = appState.selectedStationId;
  els.favToggleIcon.textContent =
    sid != null && isFavorite(appState.favorites, sid) ? "★" : "☆";
}

export function updateCard(st) {
  if (!st) {
    appState.selectedStationListIndex = null;
    appState.selectedStationId = null;
    els.cardTitle.textContent = "대여소를 선택하세요";
    els.cardSub.textContent = "마커를 누르면 상세 정보가 표시됩니다.";
    els.cardBikes.textContent = "-";
    els.cardRatio.textContent = "-";
    els.cardCongestion.style.borderColor = "";
    els.cardCongestion.style.color = "";
    els.cardCongestion.textContent = "-";
    els.cardUsage.textContent = "-";
    renderStationDetail(null);
    els.favToggleBtn.disabled = true;
    els.favToggleIcon.textContent = "☆";
    return;
  }

  els.cardTitle.textContent = st.stationName;
  els.cardSub.textContent = st.region ? st.region : "지역 정보 없음";
  fillCardStationMetrics(st);

  els.cardUsage.textContent = `대여 ${st.rentalCount}회 / 반납 ${st.returnCount}회`;

  renderStationDetail(st.stationDetail ?? {});

  els.favToggleBtn.disabled = false;
  els.favToggleIcon.textContent = isFavorite(appState.favorites, st.stationId) ? "★" : "☆";
}
