# 전국 공영자전거 통합 정보 웹서비스

공공데이터포털 오픈 API(대여소 정보·대여가능 현황·대여/반납 건수 등)를 묶어, **지역 탭 + 카카오맵**으로 대여소·재고·대여·반납 정보를 보여주는 웹앱입니다.

| 구분 | 기술 |
|------|------|
| 백엔드 | Node.js, Express, Axios — API 병합 후 통합 JSON |
| 프론트 | HTML/CSS, ES 모듈(Vanilla JS), 카카오맵, `localStorage` 즐겨찾기 |

---

## 프로젝트 구조

```
2026 통합데이터/
├── frontend/
│   ├── index.html          # 카카오 SDK(appkey), 초기 로딩 오버레이
│   ├── config.js           # 백엔드 베이스 URL(APP_CONFIG)
│   ├── styles.css
│   └── src/
│       ├── app.js              # 진입점
│       ├── bootstrap.js        # 초기화 순서
│       ├── appState.js         # 상태·APP_STATE
│       ├── elements.js         # DOM 참조
│       ├── mapRuntime.js       # 지도·마커 인스턴스
│       ├── api.js              # /api/bikes
│       ├── map.js              # 카카오 유틸
│       ├── storage.js          # 즐겨찾기
│       ├── congestion.js       # 혼잡도·% 표시
│       ├── stationDetailView.js
│       ├── stationCard.js
│       ├── stationSelection.js
│       ├── mapMarkers.js
│       ├── favoritesView.js
│       ├── rankingView.js
│       ├── regionData.js       # 탭·loadRegion
│       ├── recommend.js        # 검색·위치 추천
│       ├── events.js
│       ├── theme.js
│       └── initialOverlay.js
├── backend/
│   ├── apiMap.json         # 지역별 URL(없으면 .env 공통 URL)
│   ├── apiMap.example.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── regions.js
│       ├── routes/         # health, bikes
│       ├── services/       # bikeAggregator, apiMap
│       ├── lib/            # dataGoKr, normalize, ratio, poissonAvailability
│       └── mocks/          # USE_MOCK=true 일 때
│   └── test/
│       └── normalize.test.js   # 필드 정규화 단위 테스트
└── README.md
```

### 유지보수: 프론트 모듈 역할

- **`elements.js`**: 마크업 `id` 변경 시 이 파일만 수정하면 됩니다.
- **`regionData.js`**: 지역 전환·기간 적용 후 `fetchBikes` → 목록/마커 갱신 흐름.
- **`stationCard.js` / `stationSelection.js`**: 우측 카드와 선택 상태; 기간 적용 시 로딩 문구도 여기서 처리.
- **`normalize.js`(백엔드)**: 공공 API 필드 별칭 추가 시 이쪽을 먼저 봅니다.

### 백엔드 테스트

OpenAPI 필드 매핑이 깨지지 않도록 `normalize`에 대한 단위 테스트가 있습니다.

```bash
cd backend
npm test
```

---

## 백엔드 실행

1. `backend/.env.example`을 복사해 `backend/.env` 생성.
2. **모의 데이터**: `USE_MOCK=true`
3. **실서비스**: `USE_MOCK=false` 후 `DATA_GO_KR_SERVICE_KEY` 및 URL 설정  
   - 전역 공통: `API_STATIONS_URL`, `API_STOCK_URL`, `API_USAGE_URL`  
   - 지역별: `backend/apiMap.json` (`apiMap.example.json` 참고)
4. 선택: `FRONTEND_ORIGIN` — CORS 허용 출처(미설정 시 `cors` 기본 동작).

```bash
cd backend
npm install
npm run dev
```

- 헬스: `GET http://127.0.0.1:5179/api/health`
- 통합 데이터: `GET http://127.0.0.1:5179/api/bikes?region=서울`

---

## 프론트엔드 실행

정적 파일이므로 Live Server 또는 정적 HTTP 서버로 `frontend` 루트를 열면 됩니다.

```bash
cd frontend
npx --yes serve -l 5500
```

### `frontend/config.js`

`window.APP_CONFIG.BACKEND_BASE_URL`이 `/api/bikes` 요청의 호스트입니다.  
로컬 백엔드면 `http://127.0.0.1:5179`, 배포 백엔드면 해당 HTTPS URL로 맞춥니다.

### 카카오 JavaScript 키

`frontend/index.html`의 카카오 SDK 스크립트 URL에 `appkey=`를 본인 키로 바꿉니다.  
카카오 디벨로퍼스 **플랫폼 > Web**에 실제로 열리는 출처(예: `http://127.0.0.1:5500`, 배포 도메인)를 등록합니다.

---

## API 요약

### `GET /api/bikes`

| 쿼리 | 설명 |
|------|------|
| `region` | 지역명(예: `서울`) |
| `startDate`, `endDate` | `YYYYMMDD` — 대여/반납 통계 기간(`fromCrtrYmd` / `toCrtrYmd`로 매핑) |
| `nowHour` | `0`–`23` — 포아송 기반 대여 가능 확률 계산용(프론트가 로컬 시각으로 전달) |

응답에 `regions`(탭용 메타), `stations`(병합 결과), `stats`, `warnings`, `source`(mock/openapi) 등이 포함될 수 있습니다.

`stations[]` 한 행 예시:

```json
{
  "stationId": "108",
  "stationName": "서교동 사거리",
  "lat": 37.55,
  "lng": 126.91,
  "region": "서울",
  "availableBike": 3,
  "totalRack": 15,
  "rentalCount": 9,
  "returnCount": 11,
  "congestion": { "ratio": 0.2, "level": "low", "label": "부족", "color": "#EF4444" },
  "availability": { "prob": 0.35 },
  "stationDetail": { "operBgngHrCn": "060000", "mngInstTelno": "02-0000-0000" }
}
```

(실제 키·값은 데이터셋·병합 결과에 따라 다를 수 있습니다.)

---

## 화면 기능

- **지역 탭**: 선택 시 해당 지역 데이터만 지도·목록에 반영.
- **초기 로딩**: 첫 진입 시 데이터·탭·마커가 준비될 때까지 전체 오버레이로 안내 문구 표시 후 해제.
- **마커 색**: 거치대 대비 가용 대수 비율(없으면 지역 내 최대 가용 대수 대비 보정).
- **대여 가능 확률**: 포아송 모델(시간대·기간 반영); 불가 시 거치대 비율 또는 보정 비율로 표시.
- **대여소 카드**: 이름·지역·자전거 수·확률·혼잡도·대여/반납 건수·공공데이터 상세 필드.
- **대여/반납 기간 검색 + 적용**: 기간을 넣고 적용 시 API 재요청. **대여소가 이미 선택된 경우** 로딩 중 카드 상단에 `대여/반납 정보를 조회 중입니다.`를 잠시 표시한 뒤, 같은 대여소 정보로 다시 채움.
- **즐겨찾기**, **추천 순위(자전거 보유 상위)**, **대여소명 검색**, **내 위치 기반 대여/반납 추천**.

---

## 배포 메모

- 프론트는 GitHub Pages 등 정적 호스팅에 올리고, `config.js`의 백엔드 URL을 운영 API로 둡니다.
- 백엔드는 Render·Railway 등에 배포 시 `.env`에 서비스 키와 URL을 설정하고, CORS용 `FRONTEND_ORIGIN`을 프론트 출처에 맞춥니다.

---

## 대여/반납 API 날짜 파라미터

데이터셋에 따라 쿼리 키 이름을 바꿀 수 있습니다.

- 기본: `fromCrtrYmd`, `toCrtrYmd`
- 환경변수: `USAGE_START_PARAM`, `USAGE_END_PARAM`
