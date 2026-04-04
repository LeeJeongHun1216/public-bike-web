import { appState } from "./appState.js";

export function fmtPct(ratio) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return "-";
  const n = Math.round((ratio || 0) * 100);
  return `${n}%`;
}

export function fallbackRatioByAvailable(st) {
  const maxAvail = appState.maxAvailableBike || 0;
  if (maxAvail <= 0) return null;
  const r = (st.availableBike || 0) / maxAvail;
  return Math.max(0, Math.min(1, r));
}

export function ratioToLevel(ratio) {
  if (ratio == null) return { label: "정보없음", color: "#9CA3AF" };
  if (ratio < 0.3) return { label: "부족", color: "#EF4444" };
  if (ratio < 0.7) return { label: "보통", color: "#F97316" };
  return { label: "여유", color: "#22C55E" };
}
