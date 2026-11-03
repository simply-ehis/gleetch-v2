// src/core/shuffle3.js
// Three-layer shuffle orchestrator: base -> effects -> colour.
// Pure and deterministic: same (seed, tier, options) -> same layer recipe.
// No DOM, no WebGL — base recipes come from the grammar (createRegistry /
// generateRecipe) so this runs in plain Node and is trivial to test.
// Rendering is handled by src/core/layers.js (renderLayer1/2/3).
//
//   import { shuffle3 } from './shuffle3.js';
//   const recipe = shuffle3({ seed, tier: 'high', rng: prng(seed) });
//   // -> { base: { family, recipe }, effects: [...], intensity, colour }
//
// Order of a shuffle: pick base, pick mode & count, pick effects within budget,
// pick colour source & method. Shuffle is all or nothing — no layer locking.

import { generateRecipe, familyWeights } from '../base-engine/grammar.js';
import { createRegistry } from '../base-engine/rules.js';
import { getEffectsFor } from '../effects/registry.js';
import { prng } from './rng.js';

// Layer-2 effect count per tier: min..max effects on each shuffle.
export const LAYER2_COUNT = {
  high: { min: 1, max: 4 },
  medium: { min: 1, max: 3 },
  low: { min: 1, max: 2 },
};

// Cost budget per tier: the summed effect cost of a stack must fit.
// Caps the worst case and keeps shuffle fast (20 filters never stack).
export const LAYER2_BUDGET = { high: 14, medium: 9, low: 5 };

// Colour sources for layer 3.
export const COLOUR_SOURCES = ['base', 'effect', 'any'];

// Colour application methods for layer 3.
export const COLOUR_METHODS = ['hueShift', 'tint', 'paletteRemap', 'paintPass'];

const DEFAULT_TINT = [255, 200, 150];

// Effects that must never appear together in one stack (cross-slot clashes).
// One-per-slot is enforced separately; this catches cross-slot conflicts such
// as two colour remaps fighting over the same pixels.
const CLASHES = {
  duotone: new Set(['hueRotate', 'matrixColor']),
  hueRotate: new Set(['duotone', 'matrixColor']),
  matrixColor: new Set(['duotone', 'hueRotate']),
  overlayScreen: new Set(['overlayMultiply', 'overlayBlend']),
  overlayMultiply: new Set(['overlayScreen', 'overlayBlend']),
  overlayBlend: new Set(['overlayScreen', 'overlayMultiply']),
  oilPaint: new Set(['gaussianBlur']),
  gaussianBlur: new Set(['oilPaint']),
};

function clashesWith(id, chain) {
  const blocked = CLASHES[id];
  if (!blocked) return false;
  return chain.some((other) => blocked.has(other));
}

function pickFamily(rng, familyWhitelist) {
  const weights = familyWhitelist || familyWeights();
  const ids = Object.keys(weights);
  const total = ids.reduce((s, id) => s + weights[id], 0);
  let roll = rng() * total;
  for (const id of ids) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return ids[ids.length - 1];
}

/** Layer 1: pick a base family then generate a checked base recipe. */
export function shuffleBase({ seed, tier, family, rng }) {
  const fam = family || pickFamily(rng);
  const recipe = generateRecipe(createRegistry(), { seed, family: fam, tier });
  return { family: fam, recipe, seed: recipe.seed };
}

/** Layer 2: pick a random count (within tier min/max), then effects within the
 *  cost budget, at most one per slot type, never a clashing pair. */
export function shuffleEffects({ seed, tier, rng, exclude = [] }) {
  const pool = getEffectsFor('image');
  const { min, max } = LAYER2_COUNT[tier] || LAYER2_COUNT.medium;
  const budget = LAYER2_BUDGET[tier] || LAYER2_BUDGET.medium;
  const count = min + Math.floor(rng() * (max - min + 1));

  const taken = new Set(exclude);
  const usedSlot = new Set();
  const chain = [];
  let cost = 0;

  const attemptsLimit = count * 40;
  let attempts = 0;
  while (chain.length < count && attempts < attemptsLimit) {
    attempts++;
    // Pick a random slot not yet used, then a random effect from that slot.
    const slots = [...new Set(pool.map((e) => e.slot))].filter((s) => !usedSlot.has(s));
    if (!slots.length) break;
    const slot = slots[Math.floor(rng() * slots.length)];
    const candidates = pool.filter(
      (e) => e.slot === slot && !taken.has(e.id) && !chain.includes(e.id) && !clashesWith(e.id, chain)
    );
    if (!candidates.length) {
      // Mark this slot as unusable for this chain and try another.
      usedSlot.add(slot);
      continue;
    }
    const effect = candidates[Math.floor(rng() * candidates.length)];
    const ecost = effect.cost ?? 2;
    if (cost + ecost > budget) {
      // Can't afford this effect; try another slot/effect.
      usedSlot.add(slot);
      continue;
    }
    chain.push(effect.id);
    taken.add(effect.id);
    usedSlot.add(effect.slot);
    cost += ecost;
  }

  return { effects: chain, cost };
}

/** Layer 3: pick a colour source and 1..3 application methods/passes. */
export function shuffleColour({ seed, rng, baseRecipe, effects }) {
  const source = COLOUR_SOURCES[Math.floor(rng() * COLOUR_SOURCES.length)];
  const passCount = 1 + Math.floor(rng() * 2); // 1..2 passes by default
  const passes = [];
  const usedMethod = new Set();
  for (let i = 0; i < passCount; i++) {
    const methods = COLOUR_METHODS.filter((m) => !usedMethod.has(m));
    if (!methods.length) break;
    const method = methods[Math.floor(rng() * methods.length)];
    usedMethod.add(method);
    const pass = { method, weight: 0.5 + rng() * 0.6 };
    if (method === 'tint') {
      const jitter = (rng() - 0.5) * 60;
      pass.tint = [
        Math.max(0, Math.min(255, DEFAULT_TINT[0] + jitter)),
        Math.max(0, Math.min(255, DEFAULT_TINT[1] + jitter * 0.6)),
        Math.max(0, Math.min(255, DEFAULT_TINT[2] - jitter * 0.4)),
      ];
      pass.amount = 0.2 + rng() * 0.45;
    } else if (method === 'hueShift') {
      pass.shift = Math.floor(rng() * 60) - 30;
    } else if (method === 'paletteRemap') {
      pass.palette = baseRecipe ? baseRecipe.palette : null;
    }
    passes.push(pass);
  }
  return { source, passes };
}

/** Full three-layer shuffle. Returns a layer recipe ready for layers.js. */
export function shuffle3(opts = {}) {
  const { seed, tier = 'medium', family, rng: outerRng } = opts;
  const rng = outerRng || prng(seed ?? 0);
  const baseSeed = (seed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
  const baseRng = prng(baseSeed);
  const fxSeed = (baseSeed * 0x85ebca6b + 0x9e3779b9) >>> 0;
  const fxRng = prng(fxSeed);
  const colourSeed = (fxSeed * 0x85ebca6b + 0x9e3779b9) >>> 0;
  const colourRng = prng(colourSeed);

  const base = shuffleBase({ seed: baseSeed, tier, family, rng: baseRng });
  const effectsResult = shuffleEffects({ seed: fxSeed, tier, rng: fxRng, exclude: opts.exclude });
  const intensity = 0.3 + fxRng() * 0.6;
  const colour = shuffleColour({ seed: colourSeed, rng: colourRng, baseRecipe: base.recipe, effects: effectsResult.effects });

  return {
    seed: baseSeed,
    tier,
    family: base.family,
    base: { family: base.family, recipe: base.recipe },
    effects: effectsResult.effects,
    effectCost: effectsResult.cost,
    intensity,
    colour,
  };
}

/** Default base family presets (labels for the UI). */
export const BASE_FAMILIES = {
  beauty: 'Beauty and aesthetics',
  illusions: 'Illusions',
  patterns: 'Patterns',
  art: 'Art',
  effects: 'Special effects',
};

export default { shuffle3, shuffleBase, shuffleEffects, shuffleColour, LAYER2_COUNT, LAYER2_BUDGET, COLOUR_SOURCES, COLOUR_METHODS, BASE_FAMILIES };
