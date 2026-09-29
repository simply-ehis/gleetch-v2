import { PATTERNS } from '../patterns/registry.js';
import { prng, fbm } from './rng.js';
import { makeOffscreenCanvas } from './canvas-utils.js';

const BLENDS = ['source-over', 'screen', 'multiply', 'overlay', 'soft-light'];

// Pick patterns deterministically but diverse families
function pickPatterns(rng, count) {
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

/**
 * Render a procedural video frame.
 * Like renderProcedural but time-animated:
 * - Clip-stable pattern choice (from seed), per-frame time jitter via rng
 * - Subtle time evolution so video doesn't just flicker to a new random pattern every frame
 * - Deterministic: same seed + same timeMs => same pixels
 */
export function renderProceduralVideoFrame(ctx, W, H, seed, timeMs, opts = {}) {
  ctx.clearRect(0, 0, W, H);
  const maxLayers = opts.maxLayers ?? 3;
  // Clip-stable base: pattern set chosen from seed only, holds for whole clip
  const clipRng = prng(seed);
  let layers = 1;
  const r = clipRng();
  if (maxLayers >= 2 && r > 0.55) layers = 2;
  if (maxLayers >= 3 && r > 0.82) layers = 3;
  layers = Math.min(layers, maxLayers);
  const picks = pickPatterns(clipRng, layers);

  // Stable rng for the whole clip — patterns don't re-pick, they evolve.
  const stableRng = prng(seed);
  const frameRng = stableRng;

  // Subtle animated offset: shift pattern via translation (cheap) to give motion
  // without re-rolling pattern choice. Use fbm for smooth drift.
  const driftX = fbm(timeMs * 0.0003, 0, seed) * 24 - 12;
  const driftY = fbm(0, timeMs * 0.0003, seed + 999) * 24 - 12;
  const rot = Math.sin(timeMs * 0.001 + seed) * 0.02; // smooth micro-rotation

  // Time-quantized tick so pattern internals evolve stepwise (~8fps) instead
  // of flickering every millisecond, while staying fully deterministic for
  // a given (seed, timeMs). Mixed into the per-layer rng seeds below.
  const frameTick = Math.max(0, Math.floor(timeMs / 120));

  if (layers === 1) {
    ctx.save();
    if (driftX || driftY) ctx.translate(driftX, driftY);
    if (rot) { ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.translate(-W / 2, -H / 2); }
    picks[0].fn(ctx, W, H, frameRng);
    ctx.restore();
    return;
  }

  // Multi-layer: composite with time-varying alpha/blend (still clip-stable pick, frame-varying blend)
  const off = makeOffscreenCanvas(W, H);
  const octx = off.getContext('2d');

  // Base layer with drift
  ctx.save();
  if (driftX || driftY) ctx.translate(driftX * 0.6, driftY * 0.6);
  picks[0].fn(ctx, W, H, prng(seed ^ 0x9e3779b9 ^ frameTick));
  ctx.restore();

  for (let i = 1; i < picks.length; i++) {
    octx.clearRect(0, 0, W, H);
    octx.save();
    // alternate drift direction per layer for parallax
    const lx = driftX * (i % 2 ? -0.7 : 0.5);
    const ly = driftY * (i % 2 ? 0.5 : -0.7);
    if (lx || ly) octx.translate(lx, ly);
    picks[i].fn(octx, W, H, prng(seed ^ (0x85ebca6b + i * 0x9e3779b9) ^ frameTick));
    octx.restore();
    const mode = BLENDS[Math.floor(frameRng() * BLENDS.length)];
    // alpha evolves slowly with time, but stays in 0.38-0.8 range
    const alpha = 0.38 + (frameRng() * 0.42 * (0.7 + 0.3 * Math.sin(timeMs * 0.001 + i)));
    ctx.globalAlpha = Math.max(0.2, Math.min(0.85, alpha));
    ctx.globalCompositeOperation = mode;
    ctx.drawImage(off, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
