import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomEffectSelection, getEffectsFor } from '../src/effects/registry.js';
import { prng } from '../src/core/rng.js';
import { randomSeed } from '../src/core/constants.js';
import { recordShuffle, getFreshness, clearHistory } from '../src/core/shuffle-history.js';
import { getRating } from '../src/effects/ratings.js';

const N = 10000;

function shuffleFairness(media) {
  const pool = getEffectsFor(media);
  const counts = Object.fromEntries(pool.map((e) => [e.id, 0]));
  let chain = [], heavy = 0, pairs = 0, sameCat = 0;
  const catOf = Object.fromEntries(pool.map((e) => [e.id, e.category]));
  const isVideo = media === 'video';
  for (let i = 0; i < N; i++) {
    chain = randomEffectSelection(media, prng(randomSeed()), { exclude: chain, realtimeOnly: isVideo });
    chain.forEach((id) => { counts[id]++; });
    for (let j = 1; j < chain.length; j++) { pairs++; if (catOf[chain[j]] === catOf[chain[j - 1]]) sameCat++; }
    if (isVideo && chain.some((id) => pool.find((e) => e.id === id)?.realtimeSafe === false)) heavy++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rsum = pool.reduce((a, e) => a + getRating(e.id), 0);
  const rows = pool.map((e) => ({ id: e.id, cat: e.category, x: counts[e.id] / (total * getRating(e.id) / rsum) })).sort((a, b) => b.x - a.x);
  const outside = rows.filter((r) => r.x < 0.75 || r.x > 1.25).length;
  return { pool: pool.length, outside, sameCatPct: 100 * sameCat / pairs, heavyPct: 100 * heavy / N, rows };
}

test('W1: shuffle fairness with ratings', () => {
  clearHistory();
  for (const media of ['image', 'video', 'text']) {
    const pool = getEffectsFor(media);
    const counts = Object.fromEntries(pool.map((e) => [e.id, 0]));
    const isVideo = media === 'video';
    let chain = [];
    for (let i = 0; i < N; i++) {
      clearHistory();
      chain = randomEffectSelection(media, prng(randomSeed()), { exclude: chain, realtimeOnly: isVideo });
      chain.forEach((id) => { counts[id]++; });
      clearHistory();
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const rsum = pool.reduce((a, e) => a + getRating(e.id), 0);
    const rows = pool.map((e) => ({ id: e.id, x: counts[e.id] / (total * getRating(e.id) / rsum) }));
    const outside = rows.filter((r) => r.x < 0.75 || r.x > 1.25).length;
    const target = Math.ceil(pool.length * 0.4);
    assert.ok(outside <= target, `[${media}] ${outside}/${pool.length} outside 0.75x-1.25x (target <= ${target})`);
  }
  clearHistory();
});

test('W1: alternation preserved', () => {
  clearHistory();
  const baselines = { image: 11, video: 9, text: 18 };
  for (const [media, baseline] of Object.entries(baselines)) {
    const pool = getEffectsFor(media);
    const isVideo = media === 'video';
    let pairs = 0, sameCat = 0;
    const catOf = Object.fromEntries(pool.map((e) => [e.id, e.category]));
    let chain = [];
    for (let i = 0; i < N; i++) {
      clearHistory();
      chain = randomEffectSelection(media, prng(randomSeed()), { exclude: chain, realtimeOnly: isVideo });
      for (let j = 1; j < chain.length; j++) { pairs++; if (catOf[chain[j]] === catOf[chain[j - 1]]) sameCat++; }
    }
    const sameCatPct = 100 * sameCat / pairs;
    assert.ok(sameCatPct <= baseline + 1, `[${media}] same-category neighbours ${sameCatPct.toFixed(1)}% > baseline ${baseline}%`);
  }
  clearHistory();
});

test('W1: video realtimeOnly filter excludes heavy effects', () => {
  const pool = getEffectsFor('video');
  const heavyIds = pool.filter((e) => e.realtimeSafe === false).map((e) => e.id);
  if (heavyIds.length === 0) return;
  let chain = [];
  for (let i = 0; i < 1000; i++) {
    chain = randomEffectSelection('video', prng(randomSeed()), { exclude: chain, realtimeOnly: true });
    for (const id of chain) {
      assert.ok(!heavyIds.includes(id), `realtimeOnly chain contains heavy effect: ${id}`);
    }
  }
});

test('W1: freshness down-weights recent effects', () => {
  clearHistory();
  recordShuffle(['duotone', 'pixelSort']);
  assert.equal(getFreshness('duotone'), 0.25);
  assert.equal(getFreshness('pixelSort'), 0.25);
  assert.equal(getFreshness('zalgo'), 1);
  clearHistory();
});

test('W1: ratings affect pick frequency', () => {
  clearHistory();
  const pool = getEffectsFor('image');
  const lowRated = pool.find((e) => getRating(e.id) <= 0.8);
  const highRated = pool.find((e) => getRating(e.id) >= 1.3);
  if (!lowRated || !highRated) return;
  const counts = { low: 0, high: 0 };
  let chain = [];
  for (let i = 0; i < N; i++) {
    chain = randomEffectSelection('image', prng(randomSeed()), { exclude: chain });
    if (chain.includes(lowRated.id)) counts.low++;
    if (chain.includes(highRated.id)) counts.high++;
  }
  assert.ok(counts.high > counts.low, `high-rated (${highRated.id}, rating ${getRating(highRated.id)}) picked ${counts.high}x vs low-rated (${lowRated.id}, rating ${getRating(lowRated.id)}) ${counts.low}x`);
  clearHistory();
});

test('W1: consecutive shuffles share at most 1 effect on average', () => {
  clearHistory();
  let totalShared = 0;
  let comparisons = 0;
  let chain = [];
  for (let i = 0; i < 500; i++) {
    const next = randomEffectSelection('image', prng(randomSeed()), { exclude: chain });
    const shared = chain.filter((id) => next.includes(id)).length;
    totalShared += shared;
    comparisons++;
    chain = next;
    recordShuffle(next);
  }
  const avg = totalShared / comparisons;
  assert.ok(avg <= 1, `consecutive shuffles share ${avg.toFixed(2)} effects on average (target <= 1)`);
  clearHistory();
});
