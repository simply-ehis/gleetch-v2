import { PATTERNS } from '../patterns/registry.js';
import { prng } from './rng.js';
import { makeOffscreenCanvas } from './canvas-utils.js';

// Infinite procedural composition: layers 1-3 patterns with blend.
// Deterministic from seed. Quality-aware via maxLayers.
const BLENDS = ['source-over', 'screen', 'multiply', 'overlay', 'soft-light'];

function pickPatterns(rng, count) {
  // ensure family diversity: never repeat family within one composition
  const used = new Set();
  const picks = [];
  for (let i = 0; i < count; i++) {
    let pool = PATTERNS.filter((p) => !used.has(p.family));
    if (!pool.length) pool = PATTERNS;
    const pat = pool[Math.floor(rng() * pool.length)];
    picks.push(pat);
    used.add(pat.family);
  }
  return picks;
}

export function renderProcedural(ctx, W, H, seed, opts = {}) {
  ctx.clearRect(0, 0, W, H);
  const maxLayers = opts.maxLayers ?? 3;
  const rng = prng(seed);
  // pure randomness: layer count weighted but not capped to one shape
  let layers = 1;
  const r = rng();
  if (maxLayers >= 2 && r > 0.55) layers = 2;
  if (maxLayers >= 3 && r > 0.82) layers = 3;
  layers = Math.min(layers, maxLayers);

  const picks = pickPatterns(rng, layers);
  if (layers === 1) {
    picks[0].fn(ctx, W, H, rng);
    return;
  }
  // composite offscreen layers
  const off = makeOffscreenCanvas(W, H);
  const octx = off.getContext('2d');
  picks[0].fn(ctx, W, H, prng(seed ^ 0x9e3779b9));
  for (let i = 1; i < picks.length; i++) {
    octx.clearRect(0, 0, W, H);
    picks[i].fn(octx, W, H, prng(seed ^ (0x85ebca6b + i * 0x9e3779b9)));
    const mode = BLENDS[Math.floor(rng() * BLENDS.length)];
    const alpha = 0.38 + rng() * 0.42;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = mode;
    ctx.drawImage(off, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
