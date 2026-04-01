const KEY = "bike_favorites_v1";

export function loadFavorites() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids) {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function isFavorite(ids, stationId) {
  return ids.includes(stationId);
}

export function toggleFavorite(ids, stationId) {
  const next = new Set(ids);
  if (next.has(stationId)) next.delete(stationId);
  else next.add(stationId);
  const out = Array.from(next);
  saveFavorites(out);
  return out;
}

