// Web Worker for off-main-thread full-res export with progress reporting.
import { prng } from './rng.js';
import { applyEffectChain } from '../effects/registry.js';
import { renderProcedural } from './procedural.js';

self.onmessage = async (e) => {
  const { seed, algos, intensity, channel, effectParams, W, H, maxLayers = 3, source = null, fit = 'cover' } = e.data;
  try {
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    self.postMessage({ type: 'progress', value: 0.1 });
    if (source) {
      // Upload mode: the export must start from the user's image at export
      // size (cover/contain per the FORMAT fit), not a procedural render.
      // ImageBitmap carries width/height instead of naturalWidth/Height.
      const iw = source.width || 1, ih = source.height || 1;
      if (fit === 'contain') {
        ctx.fillStyle = '#0A0A1C';
        ctx.fillRect(0, 0, W, H);
        const s = Math.min(W / iw, H / ih);
        ctx.drawImage(source, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      } else {
        const s = Math.max(W / iw, H / ih);
        ctx.drawImage(source, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      }
      source.close();
    } else {
      try { renderProcedural(ctx, W, H, seed, { maxLayers }); }
      catch { ctx.fillStyle = '#FF2D6B'; ctx.fillRect(0, 0, W, H); }
    }
    self.postMessage({ type: 'progress', value: 0.4 });
    let buf = ctx.getImageData(0, 0, W, H).data;
    buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity, channel }, prng(seed + 999), effectParams);
    const img = ctx.createImageData(W, H);
    img.data.set(buf);
    ctx.putImageData(img, 0, 0);
    self.postMessage({ type: 'progress', value: 0.9 });
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ type: 'progress', value: 1 });
    self.postMessage({ type: 'done', blob });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
