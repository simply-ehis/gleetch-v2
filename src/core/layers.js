import { getBaseEngine, initBaseEngine, isBaseEngineSupported } from './base-integration.js';
import { renderProcedural } from './procedural.js';
import { applyEffectChain } from '../effects/registry.js';
import { prng } from './rng.js';
import { makeOffscreenCanvas } from './canvas-utils.js';

const cache = new Map();
function cacheKey(layer, inputs) { return layer + ':' + JSON.stringify(inputs); }

export async function ensureBaseEngine() {
  if (!isBaseEngineSupported()) return null;
  return await initBaseEngine();
}

export async function renderLayer1(recipe, W, H, opts = {}) {
  const baseRecipe = opts.baseRecipe;
  const key = cacheKey('L1', { seed: recipe.seed, W, H, manual: !!baseRecipe });
  if (cache.has(key)) return cache.get(key);
  const engine = await ensureBaseEngine();
  let buf;
  if (engine) {
    const used = baseRecipe ?? engine.shuffle({ seed: recipe.seed >>> 0, tier: recipe.tier || 'medium' });
    recipe.baseRecipe = used;
    const c = makeOffscreenCanvas(W, H);
    const ctx = c.getContext('2d');
    engine.renderTo(ctx, used, W, H);
    buf = ctx.getImageData(0, 0, W, H);
  } else {
    const c = makeOffscreenCanvas(W, H);
    const ctx = c.getContext('2d');
    renderProcedural(ctx, W, H, recipe.seed, { maxLayers: (recipe.tier === 'low' ? 1 : recipe.tier === 'medium' ? 2 : 3) });
    buf = ctx.getImageData(0, 0, W, H);
  }
  cache.set(key, buf);
  return buf;
}

export function renderLayer2(recipe, baseBuf, W, H, effectParams = {}) {
  const key = cacheKey('L2', { effects: recipe.effects, seed: recipe.seed, W, H });
  if (cache.has(key)) return cache.get(key);
  const buf = new Uint8ClampedArray(baseBuf.data);
  const ctx = { mediaType: 'image', W, H, intensity: recipe.intensity ?? 0.5, channel: 0 };
  const out = applyEffectChain(buf, recipe.effects || [], ctx, prng(recipe.seed + 999), effectParams);
  const result = { data: out, width: W, height: H };
  cache.set(key, result);
  return result;
}
export function renderLayer3(recipe, effectsBuf, W, H) {
  const colour = recipe?.colour ?? {};
  const passes = Array.isArray(colour.passes)
    ? colour.passes
    : (colour.method && colour.method !== 'none' ? [colour] : []);
  const key = cacheKey('L3', { passes, W, H });
  if (cache.has(key)) {
    return { data: new Uint8ClampedArray(cache.get(key).data), width: W, height: H };
  }
  let data = new Uint8ClampedArray(effectsBuf.data);

  const applyPass = (p) => {
    const method = p?.method || 'none';
    if (method === 'none') return;
    if (method === 'hueShift') {
      const shift = p.shift ?? 30;
      const cos = Math.cos((shift * Math.PI) / 180);
      const sin = Math.sin((shift * Math.PI) / 180);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const nr = r * (0.299 + 0.701 * cos + 0.168 * sin) + g * (0.587 - 0.587 * cos + 0.33 * sin) + b * (0.114 - 0.114 * cos - 0.497 * sin);
        const ng = r * (0.299 - 0.299 * cos - 0.328 * sin) + g * (0.587 + 0.413 * cos + 0.035 * sin) + b * (0.114 - 0.114 * cos + 0.292 * sin);
        const nb = r * (0.299 - 0.3 * cos + 1.25 * sin) + g * (0.587 - 0.588 * cos - 1.05 * sin) + b * (0.114 + 0.886 * cos - 0.203 * sin);
        data[i] = Math.max(0, Math.min(255, nr * 255));
        data[i + 1] = Math.max(0, Math.min(255, ng * 255));
        data[i + 2] = Math.max(0, Math.min(255, nb * 255));
      }
    } else if (method === 'tint') {
      const [tr, tg, tb] = p.tint ?? [255, 200, 150];
      const amt = (p.amount ?? 0.3) * (p.weight ?? 1);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * (1 - amt) + tr * amt;
        data[i + 1] = data[i + 1] * (1 - amt) + tg * amt;
        data[i + 2] = data[i + 2] * (1 - amt) + tb * amt;
      }
    } else if (method === 'paletteRemap') {
      const pal = p.palette ?? [[0, 0, 0], [255, 255, 255]];
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        const idx = Math.min(pal.length - 1, Math.floor(lum * (pal.length - 1)));
        const [pr, pg, pb] = pal[idx];
        data[i] = pr; data[i + 1] = pg; data[i + 2] = pb;
      }
    } else if (method === 'paintPass') {
      const sat = p.saturation ?? 1.2;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        data[i] = Math.max(0, Math.min(255, gray + (r - gray) * sat));
        data[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * sat));
        data[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * sat));
      }
    }
  };

  for (let i = 0; i < Math.min(passes.length, 3); i++) {
    applyPass(passes[i]);
  }

  const result = { data, width: W, height: H };
  cache.set(key, { data: new Uint8ClampedArray(data), width: W, height: H });
  return result;
}

export function invalidateCache(layerPrefix = null) {
  if (!layerPrefix) { cache.clear(); return; }
  for (const k of [...cache.keys()]) if (k.startsWith(layerPrefix)) cache.delete(k);
}

export function clearLayerCache() { cache.clear(); }
