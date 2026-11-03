import { prng } from './rng.js';
import { applyEffectChain } from '../effects/registry.js';
import { renderProcedural } from './procedural.js';
import { renderLayer1, renderLayer2, renderLayer3 } from './layers.js';

// Full-quality still render from a saved recipe. Mirrors the live preview
// pipeline: Layer 1 (base) → Layer 2 (effects) → Layer 3 (colour).
// Async because Layer 1 may need to initialise the GPU base engine.
// Falls back to the legacy procedural render if the base engine is unavailable.
export async function renderStill({ seed, algos, intensity, channel, effectParams, W, H, maxLayers = 3, dither = false, layerRecipe, colourPasses }) {
  const baseBuf = await renderBaseBuffer({ seed, W, H, maxLayers, layerRecipe });
  const fxBuf = renderLayer2({ seed, effects: algos, intensity, channel: 0 }, baseBuf, W, H, effectParams);
  const passes = (colourPasses && colourPasses.length) ? colourPasses : (layerRecipe?.colour?.passes ?? []);
  return renderLayer3({ colour: { passes } }, fxBuf, W, H);
}

async function renderBaseBuffer({ seed, W, H, maxLayers, layerRecipe }) {
  try {
    return await renderLayer1({ seed, tier: 'high' }, W, H, { baseRecipe: layerRecipe?.base?.recipe });
  } catch {
    // Legacy fallback: procedural base (no GPU engine).
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try { renderProcedural(ctx, W, H, seed, { maxLayers }); }
    catch { ctx.fillStyle = '#FF2D6B'; ctx.fillRect(0, 0, W, H); }
    return ctx.getImageData(0, 0, W, H);
  }
}

// Ordered (Bayer) dither to prevent banding in smooth dark gradients.
function applyDither(buf, W, H) {
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const threshold = 16;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = (BAYER[y % 4][x % 4] - 7.5) / 64;
      buf[i] = Math.max(0, Math.min(255, buf[i] + t * threshold));
      buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + t * threshold));
      buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + t * threshold));
    }
  }
}

export const EXPORT_SCALES = [
  { id: 'x1', label: '1×', scale: 1 },
  { id: 'x2', label: '2×', scale: 2 },
  { id: 'x3', label: '3×', scale: 3 },
  { id: 'x4', label: '4×', scale: 4 },
];

// Export sizing scales the CURRENT format dims (whatever FORMAT row the
// user picked above — 1:1, 16:9, custom, …), preserving aspect ratio, with
// the long edge capped at 4096. Fixed-aspect presets (the old PHONE/4K row)
// are gone on purpose: they silently forced 9:16 on every composition.
export function resolveExportDims(scaleId, srcW, srcH) {
  const entry = EXPORT_SCALES.find((s) => s.id === scaleId) ?? EXPORT_SCALES[2];
  const W0 = Math.max(1, Math.round(srcW) || 512);
  const H0 = Math.max(1, Math.round(srcH) || 512);
  const capScale = Math.min(entry.scale, 4096 / Math.max(W0, H0));
  const W = Math.max(64, Math.round(W0 * capScale));
  const H = Math.max(64, Math.round(H0 * capScale));
  return { W, H, capped: capScale < entry.scale };
}
