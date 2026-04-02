function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Abramowitz and Stegun approximation
function erf(x) {
  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX));

  return sign * y;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function calcAvailabilityFromMeans({ availableBike, muRent, muReturn }) {
  const B0 = safeNumber(availableBike, 0);
  const r = Math.max(0, safeNumber(muRent, 0));
  const t = Math.max(0, safeNumber(muReturn, 0));

  const totalMean = r + t;
  if (totalMean <= 0) {
    // If no events are expected, bikes stay unchanged.
    return B0 > 0 ? 1 : 0;
  }

  // D = N_return - N_rent
  // Approximating D as Normal(mean = muReturn - muRent, variance = muReturn + muRent)
  const mean = t - r;
  const variance = t + r;
  const sd = Math.sqrt(variance);

  // We need: B0 - N_rent + N_return > 0  <=>  D > -B0
  // Use continuity correction for integer D:
  // P(D >= -B0 + 1) ~ P(Normal(mean, sd) >= -B0 + 0.5)
  const threshold = -B0 + 0.5;

  const z = (threshold - mean) / sd;
  // P(D >= threshold) = 1 - Phi(z)
  const p = 1 - normalCdf(z);
  return clamp(p, 0, 1);
}

function probToAvailabilityLevel(prob) {
  if (prob == null || !Number.isFinite(prob)) {
    return { level: "unknown", label: "정보없음", color: "#9CA3AF" };
  }
  const p = clamp(prob, 0, 1);
  if (p < 0.3) return { level: "low", label: "부족", color: "#EF4444" }; // red
  if (p < 0.7) return { level: "mid", label: "보통", color: "#F97316" }; // orange
  return { level: "high", label: "여유", color: "#22C55E" }; // green
}

// nowHour: 0~23
// hourly: station.hourly map like { "07": 120, "08": 240, ... }
// days: number of days in [startDate, endDate] (inclusive). fallback = 1.
export function calcRentalAvailabilityPoisson({ availableBike, rentalCount, returnCount, hourly, nowHour, days }) {
  // nowHour는 시간대별 계산에 쓰지만, hourly 데이터가 없을 때는 평균값으로 폴백합니다.
  if (nowHour == null && (hourly == null || typeof hourly !== "object")) return null;
  const B0 = safeNumber(availableBike, 0);
  const d = days && Number.isFinite(days) && days > 0 ? days : 1;

  const nowHourNum = safeNumber(nowHour, null);
  const denom = safeNumber(rentalCount, 0) + safeNumber(returnCount, 0);
  if (denom <= 0) return null;

  const rentalFrac = safeNumber(rentalCount, 0) / denom; // 0~1

  // 1시간 구간(현재 HH)에 대한 기대 이벤트 수 muTotal을 구합니다.
  // hourly가 있으면 hourTotal/d, 없으면 전체(대여+반납)의 일일 평균/(24)로 폴백합니다.
  let muTotal = null;

  const hasHourly = hourly && typeof hourly === "object";
  if (hasHourly) {
    if (nowHourNum != null && nowHourNum >= 0 && nowHourNum <= 23) {
      const hh = String(nowHourNum).padStart(2, "0");
      const hourTotal = safeNumber(hourly?.[hh], NaN);
      const hourTotalAlt = safeNumber(hourly?.[String(nowHourNum)], NaN);
      const hourTotalFinal = Number.isFinite(hourTotal) ? hourTotal : hourTotalAlt;
      if (Number.isFinite(hourTotalFinal) && hourTotalFinal >= 0) {
        muTotal = hourTotalFinal / d; // events per hour
      }
    }
  }

  if (muTotal == null) {
    // 평균 이벤트 기반(시간대 차이는 반영 못하지만, 회색으로 떨어지는 문제를 방지)
    muTotal = denom / (d * 24);
  }

  if (!Number.isFinite(muTotal) || muTotal < 0) return null;

  const muRent = muTotal * rentalFrac;
  const muReturn = muTotal * (1 - rentalFrac);

  const prob = calcAvailabilityFromMeans({ availableBike: B0, muRent, muReturn });
  const { level, label, color } = probToAvailabilityLevel(prob);

  return { prob, ratio: prob, level, label, color };
}

