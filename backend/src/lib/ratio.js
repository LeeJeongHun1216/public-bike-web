export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function calcCongestion(availableBike, totalRack) {
  const a = safeNumber(availableBike, 0);
  const t = safeNumber(totalRack, 0);
  if (t <= 0) {
    return { ratio: 0, level: "unknown", label: "정보없음", color: "#9CA3AF" };
  }
  const ratio = clamp(a / t, 0, 1);

  if (ratio < 0.3) return { ratio, level: "low", label: "부족", color: "#EF4444" };
  if (ratio < 0.7) return { ratio, level: "mid", label: "보통", color: "#F59E0B" };
  return { ratio, level: "high", label: "여유", color: "#22C55E" };
}

