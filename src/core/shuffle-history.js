// Ring buffer of recent shuffle results for freshness weighting.
// Recently used effects get down-weighted so favourites don't repeat.
const MAX_HISTORY = 12;

let history = [];

export function recordShuffle(effectIds) {
  history.push(...effectIds);
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
}

export function getFreshness(effectId) {
  const recent = history.filter((id) => id === effectId).length;
  return recent === 0 ? 1 : 0.25;
}

export function clearHistory() {
  history = [];
}
