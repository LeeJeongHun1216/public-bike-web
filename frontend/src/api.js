const BASE = window.APP_CONFIG?.BACKEND_BASE_URL || "http://127.0.0.1:5179";

export async function fetchBikes({ region }) {
  const url = new URL("/api/bikes", BASE);
  if (region) url.searchParams.set("region", region);
  if (window.APP_STATE?.startDate) url.searchParams.set("startDate", window.APP_STATE.startDate);
  if (window.APP_STATE?.endDate) url.searchParams.set("endDate", window.APP_STATE.endDate);

  // 대여 가능 확률(포아송) 시간대별 계산을 위해 현재 로컬 시각 HH를 전달
  const nowHour = new Date().getHours(); // 0~23
  url.searchParams.set("nowHour", String(nowHour));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

