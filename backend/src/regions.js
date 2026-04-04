// 초보자 포인트: 탭/필터/지도 중심 이동에 쓰는 지역 메타데이터입니다.
// 위경도는 대표 중심값(대략). 필요하면 더 정확한 값으로 바꿔도 됩니다.
// instCd: 공공데이터포털 pbdo_v2 등에서 내려오는 지자체 코드(lcgvmnInstCd). 탭 key와 정규화 region을 맞출 때 사용합니다.
export const REGIONS = [
  { key: "서울", label: "서울", instCd: "1100000000", center: { lat: 37.5665, lng: 126.978 } },
  { key: "부산 기장군", label: "부산 기장군", instCd: "2671000000", center: { lat: 35.2442, lng: 129.2223 } },
  { key: "광주", label: "광주", instCd: "2900000000", center: { lat: 35.1595, lng: 126.8526 } },
  { key: "대전", label: "대전", instCd: "3000000000", center: { lat: 36.3504, lng: 127.3845 } },
  { key: "세종", label: "세종", instCd: "3611000000", center: { lat: 36.4801, lng: 127.2892 } },
  { key: "충남 공주시", label: "충남 공주시", instCd: "4415000000", center: { lat: 36.4466, lng: 127.119 } },
  { key: "전남 여수시", label: "전남 여수시", instCd: "4613000000", center: { lat: 34.7604, lng: 127.6622 } },
  { key: "전남 순천시", label: "전남 순천시", instCd: "4615000000", center: { lat: 34.9506, lng: 127.4872 } },
  { key: "경북 경주시", label: "경북 경주시", instCd: "4713000000", center: { lat: 35.8562, lng: 129.2247 } },
  { key: "경남 창원시", label: "경남 창원시", instCd: "4812000000", center: { lat: 35.2279, lng: 128.6811 } },
  { key: "경남 거창군", label: "경남 거창군", instCd: "4888000000", center: { lat: 35.6867, lng: 127.9095 } },
];

/** OpenAPI 행의 lcgvmnInstCd → 프론트 탭/필터용 region key */
export function regionKeyFromInstCd(instCd) {
  const s = String(instCd || "").trim();
  if (!s) return null;
  const found = REGIONS.find((r) => r.instCd === s);
  return found ? found.key : null;
}

