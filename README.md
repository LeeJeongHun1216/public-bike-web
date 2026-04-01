# 전국 공영자전거 통합 정보 웹서비스

공공데이터포털 오픈 API 3종을 통합해, 지역 탭 + 지도(카카오맵) 기반으로 **대여소/재고/대여·반납** 정보를 직관적으로 보여주는 웹서비스입니다.

- **백엔드**: Node.js + Express + Axios (3개 API 호출 → 병합 → 통합 JSON 제공)
- **프론트엔드**: HTML/CSS/Vanilla JS + 카카오맵 (마커/탭/즐겨찾기/localStorage)

---

## 프로젝트 구조

```
/project
├── /frontend
└── /backend
```

---

## 실행 방법

### 1) 백엔드 실행

`backend/.env.example`을 복사해서 `backend/.env`를 만듭니다.

- **바로 실행(모의데이터)**: `USE_MOCK=true` 유지
- **실데이터 연동**: `USE_MOCK=false`로 바꾸고 아래 값들을 채웁니다.
  - `DATA_GO_KR_SERVICE_KEY`
  - (전국 공통 URL이라면) `API_STATIONS_URL`, `API_STOCK_URL`, `API_USAGE_URL`
  - (지역별 URL이 다르면) `backend/apiMap.json`에 지역→URL 3종을 입력 (예: `backend/apiMap.example.json` 참고)

설치 및 실행:

```bash
cd backend
npm install
npm run dev
```

정상 확인:

- `GET /api/health` → `http://127.0.0.1:5179/api/health`
- `GET /api/bikes?region=서울` → `http://127.0.0.1:5179/api/bikes?region=서울`

---

### 2) 프론트엔드 실행

프론트는 정적 파일이라서 **Live Server(권장)** 또는 간단한 정적 서버로 실행하면 됩니다.

#### 방법 A) VSCode/커서 Live Server
- `frontend/index.html` 우클릭 → “Open with Live Server”
- 기본 주소 예: `http://127.0.0.1:5500`

#### 방법 B) Node 정적 서버

```bash
cd frontend
npx http-server -p 5500
```

---

## 필수 설정(카카오맵 키)

`frontend/index.html`에서 아래 부분의 `appkey`를 본인 **카카오 JavaScript 키**로 바꾸세요.

```html
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KAKAO_JAVASCRIPT_KEY&autoload=false" defer></script>
```

### 카카오 JavaScript SDK 도메인 등록

카카오 디벨로퍼스 > 내 애플리케이션 > 플랫폼 > Web에서 사이트 도메인을 등록해야 지도가 뜹니다.

- 로컬 개발: `http://127.0.0.1:5500` (Live Server 기준)
- 필요 시 추가: `http://localhost:5500`
- 백엔드 주소(`5179`)는 SDK 도메인 등록 대상이 아닙니다. 브라우저에서 열리는 프론트 주소만 등록하면 됩니다.

---

## 백엔드 API

### `GET /api/bikes?region=서울`

3개 API를 **대여소 ID 또는 이름 기준**으로 병합해 통합 JSON을 제공합니다.
대여/반납 현황정보는 기간이 필요한 경우가 있어 `startDate/endDate`(YYYYMMDD)를 추가로 받을 수 있습니다.

- 예: `GET /api/bikes?region=서울&startDate=20260401&endDate=20260407`

예시 구조(일부):

```json
{
  "region": "서울",
  "count": 123,
  "stations": [
    {
      "stationId": "SEOUL-001",
      "stationName": "강남역 3번 출구",
      "lat": 37.49,
      "lng": 127.02,
      "availableBike": 2,
      "totalRack": 10,
      "rentalCount": 5420,
      "returnCount": 5311,
      "congestion": { "ratio": 0.2, "label": "부족", "color": "#EF4444" }
    }
  ],
  "stats": {
    "topStations": [{ "stationName": "...", "rentalCount": 8920 }],
    "peakHour": "12",
    "hourlyAgg": { "08": 540, "18": 910 }
  }
}
```

---

## 기능 요약

- **지역 탭**: 클릭 시 지도 중심 이동 + 지역 데이터만 표시
- **마커 색상(혼잡도)**: \(availableBike / totalRack\) 비율 기준
  - 0~30%: 부족(빨강)
  - 30~70%: 보통(노랑)
  - 70%~: 여유(초록)
- **즐겨찾기**: 대여소 즐겨찾기 저장/삭제(localStorage) + 목록 표시
- **데이터 활용**: 인기 TOP(대여 횟수 기준), 피크 시간대(가능 시)

---

## 지역 코드(지자체 코드) 기반 호출

이 프로젝트는 `backend/apiMap.json`에 각 지역별 `lcgvmnInstCd`를 미리 등록해두었습니다.
엔드포인트는 pbdo_v2의 3개로 고정이며 지역마다 코드만 바뀌는 구조입니다.

대여/반납 현황정보 날짜 파라미터 기본값:

- 시작일: `fromCrtrYmd`
- 종료일: `toCrtrYmd`

