// modules/bbttcc-travel/scripts/travel.weather.helpers.js
// BBTTCC Weather Helpers (Alpha)

export function rollBetween(min, max) {
  min = Number(min); max = Number(max);
  if (!Number.isFinite(min)) min = 1;
  if (!Number.isFinite(max)) max = min;
  if (max < min) max = min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function weightedPick(weightMap) {
  const entries = Object.entries(weightMap || {}).filter(([_, w]) => Number(w) > 0);
  if (!entries.length) return null;

  const total = entries.reduce((s, [_, w]) => s + Number(w), 0);
  let roll = Math.random() * total;

  for (const [key, weight] of entries) {
    roll -= Number(weight);
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}
