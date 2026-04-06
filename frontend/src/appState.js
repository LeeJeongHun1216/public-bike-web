import { loadFavorites } from "./storage.js";

if (typeof window !== "undefined") {
  window.APP_STATE = window.APP_STATE || { startDate: "", endDate: "" };
}

export const DEFAULT_REGION = "서울";

export const appState = {
  regions: [],
  currentRegion: DEFAULT_REGION,
  stations: [],
  maxAvailableBike: 0,
  favorites: loadFavorites(),
  selectedStationId: null,
  /** 동일 stationId가 여러 건일 때 마커 클릭으로 정확한 행을 가리키기 위한 목록 인덱스 */
  selectedStationListIndex: null,
  /** 대여소 상세 정보 패널: 다른 대여소 선택 시에도 유지 */
  stationDetailExpanded: true,
};
