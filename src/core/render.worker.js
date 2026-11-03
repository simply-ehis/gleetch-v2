// Web Worker for off-main-thread full-res export with progress reporting.
// Runs the three-layer pipeline: base → effects → colour.
import { prng } from './rng.js';
import { applyEffectChain } from '../effects/registry.js';
import { renderLayer1, renderLayer2, renderLayer3 } from './layers.js';

self.onmessage = async (e) => {
  const { seed, algos, intensity, channel, effectParams, W, H, maxLayers = 3, source = null, fit = 'cover', layerRecipe, colourPasses } = e.data;
  try {
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    self.postMessage({ type: 'progress', value: 0.1 });
    let baseBuf;
    if (source) {
      // Upload mode: start from the user's image at export size.
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
      baseBuf = ctx.getImageData(0, 0, W, H);
    } else {
      baseBuf = await renderLayer1({ seed, tier: 'high' }, W, H, { baseRecipe: layerRecipe?.base?.recipe });
    }
    self.postMessage({ type: 'progress', value: 0.4 });
    const fxBuf = renderLayer2({ seed, effects: algos, intensity, channel: 0 }, baseBuf, W, H, effectParams);
    const passes = (colourPasses && colourPasses.length) ? colourPasses : (layerRecipe?.colour?.passes ?? []);
    const final = renderLayer3({ colour: { passes } }, fxBuf, W, H);
    self.postMessage({ type: 'progress', value: 0.9 });
    const img = ctx.createImageData(W, H);
    img.data.set(final.data);
    ctx.putImageData(img, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ type: 'progress', value: 1 });
    self.postMessage({ type: 'done', blob });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
