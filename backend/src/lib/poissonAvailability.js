import { calcCongestion } from "./ratio.js";

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

// nowHour: 0~23
// hourly: station.hourly map like { "07": 120, "08": 240, ... }
// days: number of days in [startDate, endDate] (inclusive). fallback = 1.
export function calcRentalAvailabilityPoisson({ availableBike, rentalCount, returnCount, hourly, nowHour, days }) {
  if (nowHour == null || hourly == null || typeof hourly !== "object") return null;
  const B0 = safeNumber(availableBike, 0);
  if (B0 <= 0) {
    // Still might be possible to become >0 if returns happen, so don't short-circuit to 0.
  }

  const nowHourNum = safeNumber(nowHour, null);
  if (nowHourNum == null || nowHourNum < 0 || nowHourNum > 23) return null;

  const hh = String(nowHourNum).padStart(2, "0");
  const hourTotal = safeNumber(hourly?.[hh], NaN);
  const hourTotalAlt = safeNumber(hourly?.[String(nowHourNum)], NaN);
  const hourTotalFinal = Number.isFinite(hourTotal) ? hourTotal : hourTotalAlt;
  if (!Number.isFinite(hourTotalFinal) || hourTotalFinal < 0) return null;

  const denom = safeNumber(rentalCount, 0) + safeNumber(returnCount, 0);
  if (denom <= 0) return null;

  const rentalFrac = safeNumber(rentalCount, 0) / denom; // 0~1
  const d = days && Number.isFinite(days) && days > 0 ? days : 1;

  // Assuming hourly[HH] is the total event count for that hour across the selected date range.
  // Convert to expected events per hour: mu = hourTotal / days (and horizon is 1 hour).
  const muTotal = hourTotalFinal / d;
  if (!Number.isFinite(muTotal) || muTotal < 0) return null;

  const muRent = muTotal * rentalFrac;
  const muReturn = muTotal * (1 - rentalFrac);

  const prob = calcAvailabilityFromMeans({ availableBike: B0, muRent, muReturn });

  // Reuse the same threshold/color convention as the existing congestion ratio.
  const congestionLike = calcCongestion(prob, 1);
  return {
    prob,
    ratio: prob, // backward-compat convenience
    level: congestionLike.level,
    label: congestionLike.label,
    color: congestionLike.color,
  };
}

