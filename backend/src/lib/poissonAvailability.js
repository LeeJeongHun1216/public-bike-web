// Poisson(대여/반납 이벤트) 기반 "다음 1시간 내 대여 가능(>=1대)" 확률 근사
// - 사용: availability.prob (0~1)
// - 데이터가 충분치 않으면 null 반환(프론트에서 fallback 가능)

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Abramowitz and Stegun approximation for erf + normal CDF
function erf(x) {
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
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return sign * y;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function calcAvailabilityFromMeans({ availableBike, muRent, muReturn }) {
  const B0 = safeNumber(availableBike, 0);
  const r = Math.max(0, safeNumber(muRent, 0));
  const t = Math.max(0, safeNumber(muReturn, 0));

  // D = N_return - N_rent  ~ Normal(mean=t-r, variance=t+r)
  const totalMean = r + t;
  if (totalMean <= 0) {
    // 이벤트 기대치가 0이면 현재 B0가 유지된다고 보고
    return B0 > 0 ? 1 : 0;
  }

  const mean = t - r;
  const variance = t + r;
  const sd = Math.sqrt(variance);

  // B0 - N_rent + N_return > 0  <=>  D > -B0
  // 연속성 보정(정수 D 기준): P(D >= -B0 + 1) 근사
  const threshold = -B0 + 0.5;
  const z = (threshold - mean) / sd;
  const prob = 1 - normalCdf(z);
  return clamp(prob, 0, 1);
}

function probToLevelColor(prob) {
  if (prob == null || !Number.isFinite(prob)) return { level: "unknown", label: "정보없음", color: "#9CA3AF" };
  const p = clamp(prob, 0, 1);
  if (p < 0.3) return { level: "low", label: "부족", color: "#EF4444" };
  if (p < 0.7) return { level: "mid", label: "보통", color: "#F97316" };
  return { level: "high", label: "여유", color: "#22C55E" };
}

export function calcRentalAvailabilityPoisson({ availableBike, rentalCount, returnCount, hourly, nowHour, days }) {
  const B0 = safeNumber(availableBike, 0);

  const rental = safeNumber(rentalCount, 0);
  const ret = safeNumber(returnCount, 0);
  const denom = rental + ret;

  // 이벤트 기반 평균을 만들 수 없으면 확률 계산을 보류
  if (denom <= 0) return null;

  const d = days && Number.isFinite(days) && days > 0 ? days : 1;
  const rentalFrac = denom > 0 ? rental / denom : 0.5;

  let muTotal = null; // "다음 1시간"의 기대 이벤트 수

  const hasHourly = hourly && typeof hourly === "object";
  const nowHourNum = nowHour == null ? null : Number(nowHour);
  if (hasHourly && nowHourNum != null && nowHourNum >= 0 && nowHourNum <= 23) {
    const hh = String(nowHourNum).padStart(2, "0");
    const hourTotal = safeNumber(hourly?.[hh], NaN);
    if (Number.isFinite(hourTotal) && hourTotal >= 0) {
      // hourly[HH]가 "선택 기간 동안 HH시대 합계"라고 가정: 다음 1시간 기대값 = hourly[HH] / days
      muTotal = hourTotal / d;
    }
  }

  // hourly가 없거나 현재 시간대 데이터가 없으면, 전체 이벤트 평균으로 폴백
  if (muTotal == null || !Number.isFinite(muTotal) || muTotal < 0) {
    muTotal = denom / (d * 24);
  }

  if (!Number.isFinite(muTotal) || muTotal < 0) return null;

  const muRent = muTotal * rentalFrac;
  const muReturn = muTotal * (1 - rentalFrac);

  const prob = calcAvailabilityFromMeans({ availableBike: B0, muRent, muReturn });
  const { level, label, color } = probToLevelColor(prob);

  return { prob, level, label, color };
}

