import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codePoints, graphemes } from '../src/core/text-utils.js';
import { applyEffectChain, applyVideoEffectChain, getEffectsFor, randomEffectSelection } from '../src/effects/registry.js';
import { prng } from '../src/core/rng.js';
import { randomSeed } from '../src/core/constants.js';
import { clearHistory } from '../src/core/shuffle-history.js';
import { getRating } from '../src/effects/ratings.js';

const N = 10000;

function shuffleFairness(media) {
  const pool = getEffectsFor(media);
  const counts = Object.fromEntries(pool.map((e) => [e.id, 0]));
  let chain = [], heavy = 0, pairs = 0, sameCat = 0;
  const catOf = Object.fromEntries(pool.map((e) => [e.id, e.category]));
  const isVideo = media === 'video';
  for (let i = 0; i < N; i++) {
    clearHistory();
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

function loneSurrogates(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) i++; else n++;
    } else if (c >= 0xDC00 && c <= 0xDFFF) n++;
  }
  return n;
}

test('codePoints handles astral characters', () => {
  const s = 'A\u{1D400}B';
  const cps = codePoints(s);
  assert.equal(cps.length, 3);
  assert.equal(cps[0], 'A');
  assert.equal(cps[1], '\u{1D400}');
  assert.equal(cps[2], 'B');
});

test('graphemes handles combining marks', () => {
  const s = 'e\u0301';
  const g = graphemes(s);
  assert.equal(g.length, 1);
  assert.equal(g[0], s);
});

test('text effects do not break astral-plane characters', () => {
  const text = 'The old king wrote his name in stone and left it for the sea to read.';
  const astral = '\u{1D400}\u{13000}\u{10000}';
  const combined = text + astral;
  for (const fx of getEffectsFor('text').map((e) => e.id).filter((id) => id !== 'fontShuffle')) {
    let bad = 0;
    for (let s = 1; s <= 200; s++) {
      const out = applyEffectChain(combined, ['fontShuffle', fx], { mediaType: 'text', intensity: 0.6 }, prng(s));
      if (loneSurrogates(out) > 0) bad++;
    }
    assert.equal(bad, 0, `fontShuffle -> ${fx}: ${bad}/200 broken`);
  }
});

test('shuffle fairness: all ratings default to 1 means fair share', () => {
  clearHistory();
  for (const media of ['image', 'video', 'text']) {
    const result = shuffleFairness(media);
    const target = Math.ceil(result.pool * 0.4);
    assert.ok(result.outside <= target, `[${media}] ${result.outside}/${result.pool} outside 0.75x-1.25x (target <= ${target})`);
  }
  clearHistory();
});

test('shuffle alternation: same-category neighbours not above baseline', () => {
  clearHistory();
  const baselines = { image: 11, video: 9, text: 18 };
  for (const [media, baseline] of Object.entries(baselines)) {
    const result = shuffleFairness(media);
    assert.ok(result.sameCatPct <= baseline + 0.5, `[${media}] same-category neighbours ${result.sameCatPct.toFixed(1)}% > baseline ${baseline}%`);
  }
  clearHistory();
});

test('video shuffle: no heavy effects in default pool', () => {
  clearHistory();
  const result = shuffleFairness('video');
  assert.equal(result.heavyPct, 0, `video shuffles with heavy effects: ${result.heavyPct}%`);
  clearHistory();
});

test('env defaults do not change still-image output', () => {
  const data = new Uint8ClampedArray(4 * 64 * 64);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7 + 13) % 256;
  const ctx = { mediaType: 'image', W: 64, H: 64, intensity: 0.5 };
  const effects = getEffectsFor('image').slice(0, 5).map((e) => e.id);
  const withoutEnv = applyEffectChain(data, effects, ctx, prng(42), {});
  const withEnv = applyEffectChain(data, effects, ctx, prng(42), {}, { t: 0, phase: 0, dt: 0, frame: 0, duration: 0, loop: false, s: 1 });
  assert.deepEqual(withEnv, withoutEnv);
});

test('applyVideoEffectChain skips heavy effects by default', () => {
  const data = new Uint8ClampedArray(4 * 32 * 32);
  for (let i = 0; i < data.length; i++) data[i] = (i * 11 + 7) % 256;
  const ctx = { mediaType: 'video', W: 32, H: 32, intensity: 0.5 };
  const heavyIds = getEffectsFor('video').filter((e) => e.realtimeSafe === false).map((e) => e.id);
  if (heavyIds.length > 0) {
    const result = applyVideoEffectChain(data, heavyIds, ctx, 123, 456, {}, false);
    assert.deepEqual(result, data);
  }
});
