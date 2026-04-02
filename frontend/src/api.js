const BASE = window.APP_CONFIG?.BACKEND_BASE_URL || "http://127.0.0.1:5179";

export async function fetchBikes({ region }) {
  const url = new URL("/api/bikes", BASE);
  if (region) url.searchParams.set("region", region);
  if (window.APP_STATE?.startDate) url.searchParams.set("startDate", window.APP_STATE.startDate);
  if (window.APP_STATE?.endDate) url.searchParams.set("endDate", window.APP_STATE.endDate);

  // 현재 시각 기준(사용자 로컬 시간) + 시간대별 확률 계산을 위해 nowHour를 함께 전달
  const nowHour = new Date().getHours(); // 0~23 (local)
  url.searchParams.set("nowHour", String(nowHour));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

