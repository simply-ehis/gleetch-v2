// Web Worker for off-main-thread full-res export with progress reporting.
import { prng } from './rng.js';
import { applyEffectChain } from '../effects/registry.js';
import { renderProcedural } from './procedural.js';

self.onmessage = (e) => {
  const { seed, algos, intensity, channel, effectParams, W, H, maxLayers = 3 } = e.data;
  try {
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    self.postMessage({ type: 'progress', value: 0.1 });
    try { renderProcedural(ctx, W, H, seed, { maxLayers }); }
    catch { ctx.fillStyle = '#FF2D6B'; ctx.fillRect(0, 0, W, H); }
    self.postMessage({ type: 'progress', value: 0.4 });
    let buf = ctx.getImageData(0, 0, W, H).data;
    buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity, channel }, prng(seed + 999), effectParams);
    self.postMessage({ type: 'progress', value: 0.9 });
    const blob = canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ type: 'progress', value: 1 });
    self.postMessage({ type: 'done', blob });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
