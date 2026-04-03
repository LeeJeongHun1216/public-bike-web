// 카카오맵 유틸(마커 생성/색상)

function svgMarker(color, label) {
  // 초보자 포인트: SVG를 data URL로 만들어 MarkerImage로 사용합니다.
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="42" viewBox="0 0 44 48">
      <path d="M22 47c9-12 16-20 16-30A16 16 0 1 0 6 17c0 10 7 18 16 30z" fill="${color}"/>
      <circle cx="22" cy="18" r="9" fill="white" opacity="0.95"/>
      <text x="22" y="22" text-anchor="middle" font-size="14" font-family="Arial" fill="${color}" font-weight="800">${label}</text>
    </svg>`,
  );
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

export function createMarkerImage({ color }) {
  // 빨강/주황/초록 모두 내부에 자전거 아이콘을 표시합니다.
  const label = "🚲";
  const url = svgMarker(color, label);
  const size = new kakao.maps.Size(38, 42);
  const offset = new kakao.maps.Point(19, 39);
  return new kakao.maps.MarkerImage(url, size, { offset });
}

export function ensureKakaoLoaded() {
  return new Promise((resolve, reject) => {
    if (!window.kakao || !window.kakao.maps) {
      reject(new Error("Kakao Maps SDK가 로드되지 않았습니다. index.html의 appkey를 확인하세요."));
      return;
    }
    kakao.maps.load(() => resolve());
  });
}

export function createMap(container, center) {
  const options = {
    center: new kakao.maps.LatLng(center.lat, center.lng),
    level: 6,
  };
  return new kakao.maps.Map(container, options);
}

export function panTo(map, center, level = null) {
  const ll = new kakao.maps.LatLng(center.lat, center.lng);
  if (typeof level === "number") map.setLevel(level);
  map.panTo(ll);
}

