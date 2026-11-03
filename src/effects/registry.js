import { prng } from '../core/rng.js';
import { getRating } from './ratings.js';
import { getFreshness } from '../core/shuffle-history.js';
import { CORRUPTION_EFFECTS } from './image/corruption.js';
import { COLOR_TONE_EFFECTS } from './image/color-tone.js';
import { DISTORTION_EFFECTS } from './image/distortion.js';
import { STYLIZE_EFFECTS } from './image/stylize.js';
import { OVERLAY_EFFECTS } from './image/overlay.js';
import { UNCANNY_EFFECTS } from './image/uncanny.js';
import { PRESENCE_EFFECTS } from './image/presence.js';
import { PARTICLE_EFFECTS } from './image/particles.js';
import { GEOMETRIC_EFFECTS } from './image/geometric.js';
import { PAINTERLY_EFFECTS } from './image/painterly.js';
import { PRINT_EFFECTS } from './image/print.js';
import { GEOMETRIC2_EFFECTS } from './image/geometric2.js';
import { PHOTO_TONE_EFFECTS } from './image/photoTone.js';
import { TEXTILE_EFFECTS } from './image/textile.js';
import { CORRUPTION2_EFFECTS } from './image/corruption2.js';
import { CRAFT_EFFECTS } from './image/craft.js';
import { ATMOSPHERE_EFFECTS } from './image/atmosphere.js';
import { TEXT_EFFECTS } from './text/corruption.js';
import { CLEAN_TONE_TEXT_EFFECTS } from './text/clean-tone.js';
import { TYPOGRAPHY_TEXT_EFFECTS } from './text/typography.js';
import { POSITION_TEXT_EFFECTS } from './text/position.js';
import { OVERFLOW_TEXT_EFFECTS } from './text/overflow.js';
import { WEB_EFFECTS } from './web/glitch.js';
import { OVERLAY_WEB_EFFECTS } from './web/overlay.js';
import { STYLIZE_WEB_EFFECTS } from './web/stylize.js';
import { AUDIO_EFFECTS } from './audio/corruption.js';
import { AUDIO_CLEAN_TONE_EFFECTS } from './audio/clean-tone.js';
import { LIGHT_EFFECTS } from './image/light.js';
import { TONE_EFFECTS } from './image/tone.js';
import { TEXTURE_EFFECTS } from './image/texture.js';
import { FORM_EFFECTS } from './image/form.js';
import { SCRIPT_TEXT_EFFECTS } from './text/script.js';
import { OVERFLOW2_TEXT_EFFECTS } from './text/overflow2.js';
import { DECAY_TEXT_EFFECTS } from './text/decay.js';
import { STRUCTURE_TEXT_EFFECTS } from './text/structure.js';

// Motion profiles by effect family. Effects not listed here use default (burst).
// Each motion names a kind from core/motion.js plus its speed, target param and a
// short list of alternate kinds the shuffle can substitute when the first is a poor fit.
export const MOTION_PROFILES = {
  // corruption → burst/steps
  dataMosh: { kind: 'burst', target: 'intensity', speed: 0.8, alternates: ['steps', 'scrub'] },
  pixelSort: { kind: 'steps', target: 'threshold', speed: 0.4, alternates: ['burst', 'scrub'] },
  bitFlip: { kind: 'burst', target: 'density', speed: 1.2, alternates: ['steps'] },
  chanShift: { kind: 'drift', target: 'offset', speed: 0.15, alternates: ['sweep'] },
  stripeBurn: { kind: 'steps', target: 'position', speed: 0.3, alternates: ['burst'] },
  // color-tone → sweep/drift
  duotone: { kind: 'sweep', target: 'huePair', speed: 0.1, alternates: ['drift', 'pulse'] },
  hueRotate: { kind: 'sweep', target: 'angle', speed: 0.08, alternates: ['sweep'] },
  matrixColor: { kind: 'drift', target: 'palette', speed: 0.12, alternates: ['sweep'] },
  quantize: { kind: 'pulse', target: 'levels', speed: 0.2, alternates: ['steps'] },
  // distortion → pulse/breathe
  waveWarp: { kind: 'pulse', target: 'amplitude', speed: 0.25, alternates: ['breathe'] },
  lensWarp: { kind: 'breathe', target: 'bulge', speed: 0.15, alternates: ['pulse'] },
  displacementMap: { kind: 'drift', target: 'scale', speed: 0.1, alternates: ['breathe'] },
  lensAberration: { kind: 'breathe', target: 'fringe', speed: 0.12, alternates: ['pulse'] },
  lineDistortion: { kind: 'pulse', target: 'frequency', speed: 0.3, alternates: ['steps'] },
  // stylize → scrub/drift
  oilPaint: { kind: 'scrub', target: 'brushSize', speed: 0.05, alternates: ['drift'] },
  watercolorBleed: { kind: 'drift', target: 'bleed', speed: 0.08, alternates: ['pulse'] },
  risograph: { kind: 'scrub', target: 'dotSize', speed: 0.06, alternates: ['steps'] },
  // overlay → drift with parallax
  overlayScreen: { kind: 'drift', target: 'offset', speed: 0.1, alternates: ['pulse'] },
  overlayMultiply: { kind: 'drift', target: 'offset', speed: 0.1, alternates: ['pulse'] },
  overlayBlend: { kind: 'drift', target: 'offset', speed: 0.1, alternates: ['pulse'] },
};

// Per-category defaults for the three layer-2 tags. New effects opt in by setting
// slot/cost/motion directly on their object; everything else inherits these.
//   slot: the layer-2 bucket an effect competes within (only one per slot per shuffle)
//   cost: weight against the tier's cost budget (heavier = costlier)
//   motion: the per-effect motion kind from core/motion.js
const SLOT_BY_CATEGORY = {
  corruption: 'distortion', 'color-tone': 'colour', distortion: 'warp', stylize: 'stylize',
  overlay: 'overlay', painterly: 'stylize', print: 'stylize', geometric: 'warp',
  geometric2: 'warp', textile: 'texture', craft: 'stylize', atmosphere: 'overlay',
  uncanny: 'overlay', presence: 'overlay', particle: 'particle',
  photoTone: 'colour', tone: 'colour', texture: 'texture', form: 'distortion',
  light: 'colour',
};
const COST_BY_CATEGORY = {
  corruption: 2, 'color-tone': 1, distortion: 2, stylize: 2, overlay: 4,
  painterly: 3, print: 3, geometric: 2, geometric2: 2, textile: 2, craft: 3,
  atmosphere: 3, uncanny: 3, presence: 4, particle: 3,
  photoTone: 2, tone: 2, texture: 2, form: 2, light: 2,
};
const MOTION_BY_CATEGORY = {
  corruption: 'burst', 'color-tone': 'sweep', distortion: 'drift', stylize: 'scrub',
  overlay: 'drift', painterly: 'scrub', print: 'pulse', geometric: 'breathe',
  geometric2: 'breathe', textile: 'drift', craft: 'pulse', atmosphere: 'drift',
  uncanny: 'pulse', presence: 'drift', particle: 'drift',
  photoTone: 'sweep', tone: 'sweep', texture: 'drift', form: 'pulse', light: 'drift',
};

function defaultSlot(category) { return SLOT_BY_CATEGORY[category] ?? 'distortion'; }
function defaultCost(category) { return COST_BY_CATEGORY[category] ?? 2; }
function defaultMotion(category) { return MOTION_BY_CATEGORY[category] ?? 'drift'; }

/** Attach layer-2 tags (slot, cost, motion) to an effect, filling defaults for
 *  anything the effect didn't declare itself. Existing effects keep working:
 *  the fields are optional and default sensibly. */
export function tagEffect(effect) {
  const category = effect.category;
  return {
    ...effect,
    slot: effect.slot ?? defaultSlot(category),
    cost: effect.cost ?? defaultCost(category),
    motion: effect.motion ?? defaultMotion(category),
  };
}

// One flat list of every effect across every media type and category.
// Each entry: { id, label, hint, category, mediaTypes[], fn, needsChannel?,
//   slot?, cost?, motion?, needsChannel?, params?, realtimeSafe?, stableAcrossFrames? }
export const ALL_EFFECTS = [
  ...CORRUPTION_EFFECTS.map(tagEffect),
  ...COLOR_TONE_EFFECTS.map(tagEffect),
  ...DISTORTION_EFFECTS.map(tagEffect),
  ...STYLIZE_EFFECTS.map(tagEffect),
  ...OVERLAY_EFFECTS.map(tagEffect),
  ...UNCANNY_EFFECTS.map(tagEffect),
  ...PRESENCE_EFFECTS.map(tagEffect),
  ...PARTICLE_EFFECTS.map(tagEffect),
  ...GEOMETRIC_EFFECTS.map(tagEffect),
  ...PAINTERLY_EFFECTS.map(tagEffect),
  ...PRINT_EFFECTS.map(tagEffect),
  ...GEOMETRIC2_EFFECTS.map(tagEffect),
  ...PHOTO_TONE_EFFECTS.map(tagEffect),
  ...TEXTILE_EFFECTS.map(tagEffect),
  ...CORRUPTION2_EFFECTS.map(tagEffect),
  ...CRAFT_EFFECTS.map(tagEffect),
  ...ATMOSPHERE_EFFECTS.map(tagEffect),
  ...TEXT_EFFECTS.map(tagEffect),
  ...CLEAN_TONE_TEXT_EFFECTS.map(tagEffect),
  ...TYPOGRAPHY_TEXT_EFFECTS.map(tagEffect),
  ...POSITION_TEXT_EFFECTS.map(tagEffect),
  ...OVERFLOW_TEXT_EFFECTS.map(tagEffect),
  ...WEB_EFFECTS.map(tagEffect),
  ...OVERLAY_WEB_EFFECTS.map(tagEffect),
  ...STYLIZE_WEB_EFFECTS.map(tagEffect),
  ...AUDIO_EFFECTS.map(tagEffect),
  ...AUDIO_CLEAN_TONE_EFFECTS.map(tagEffect),
  ...LIGHT_EFFECTS.map(tagEffect),
  ...TONE_EFFECTS.map(tagEffect),
  ...TEXTURE_EFFECTS.map(tagEffect),
  ...FORM_EFFECTS.map(tagEffect),
  ...SCRIPT_TEXT_EFFECTS.map(tagEffect),
  ...OVERFLOW2_TEXT_EFFECTS.map(tagEffect),
  ...DECAY_TEXT_EFFECTS.map(tagEffect),
  ...STRUCTURE_TEXT_EFFECTS.map(tagEffect),
];

export function getEffectsFor(mediaType) {
  return ALL_EFFECTS.filter((e) => e.mediaTypes.includes(mediaType));
}

export function getCategoriesFor(mediaType) {
  const seen = new Set();
  const categories = [];
  for (const e of getEffectsFor(mediaType)) {
    if (!seen.has(e.category)) { seen.add(e.category); categories.push(e.category); }
  }
  return categories;
}

// No-op detection: check if a chain produces near-identical output to the input.
// Returns true if the chain is a no-op (nothing visible changed).
export function isNoOp(original, processed, threshold = 0.98) {
  if (original.length !== processed.length) return true;
  let same = 0;
  const total = original.length / 4;
  for (let i = 0; i < original.length; i += 4) {
    const dr = Math.abs(original[i] - processed[i]);
    const dg = Math.abs(original[i + 1] - processed[i + 1]);
    const db = Math.abs(original[i + 2] - processed[i + 2]);
    if (dr < 4 && dg < 4 && db < 4) same++;
  }
  return same / total > threshold;
}

// Effect ids are only guaranteed unique WITHIN a media type (e.g. 'stutter'
// exists for both text and audio — same concept, different implementation).
// When mediaType is supplied, resolution is scoped to that media type so the
// right function is always picked; omit it only when the id is known to be
// unbiguous (e.g. UI code that already filtered by media type upstream).
export function getEffectById(id, mediaType) {
  if (mediaType) return ALL_EFFECTS.find((e) => e.id === id && e.mediaTypes.includes(mediaType));
  return ALL_EFFECTS.find((e) => e.id === id);
}

// Applies a chain of effect ids in order, each consuming the previous output.
// Different media types call their effect functions with different argument
// shapes, so this builds the right call per effect rather than assuming one
// universal signature (e.g. pixelSort needs an extra `channel` arg; text and
// audio effects don't take W/H at all).
//   ctx.mediaType: 'image' | 'text' | 'audio'
//   ctx.W, ctx.H, ctx.channel   — used for image effects
//   ctx.sampleRate              — used for audio effects
//   ctx.intensity
// effectParams: optional {effectId: {paramKey: value}} map for effects that
// declare their own `params` schema (validated by sanitizeParams below) —
// omit it
// entirely for chains with no param-aware effects, which is every effect
// except the ones that opt into this.
const DEFAULT_ENV = { t: 0, phase: 0, dt: 0, frame: 0, duration: 0, loop: false, s: 1 };

export function applyEffectChain(data, effectIds, ctx, rng, effectParams = {}, env = DEFAULT_ENV) {
  let result = data;
  for (const id of effectIds) {
    const effect = getEffectById(id, ctx.mediaType);
    if (!effect) continue;
    const params = effect.params ? sanitizeParams(effect, effectParams[id]) : undefined;
    if (ctx.mediaType === 'image') {
      result = effect.needsChannel
        ? effect.fn(result, ctx.W, ctx.H, ctx.intensity, ctx.channel, rng, params, env)
        : effect.fn(result, ctx.W, ctx.H, ctx.intensity, rng, params, env);
    } else if (ctx.mediaType === 'audio') {
      result = effect.fn(result, ctx.sampleRate, ctx.intensity, rng, params, env);
    } else {
      result = effect.fn(result, ctx.intensity, rng, params, env);
    }
  }
  return result;
}

// Validates a stored/loaded params value against an effect's own params
// schema, falling back to that field's default for anything missing,
// wrong-typed, or out of range — including a select value that isn't one
// of the declared options, or (importantly) a color value that isn't a
// clean #rrggbb hex string. Recipes are just JSON decoded from a URL
// parameter with no schema enforcement of their own, and some of these
// values get interpolated directly into generated CSS strings (the WEB
// tab's color params) — a crafted recipe's color field could otherwise
// break out of its CSS value context and inject arbitrary rules into
// whatever page the resulting CSS gets applied to. Validating per-field,
// not accepting-or-rejecting the whole params object, means a recipe with
// one bad field still gets every other field it set correctly.
function sanitizeParams(effect, rawParams) {
  const out = {};
  for (const p of effect.params) {
    const v = rawParams?.[p.key];
    out[p.key] = isValidParamValue(p, v) ? v : p.default;
  }
  return out;
}

function isValidParamValue(schema, v) {
  if (v === undefined || v === null) return false;
  if (schema.type === 'color') return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  if (schema.type === 'select') return schema.options.some((o) => o.value === v);
  if (schema.type === 'range') return typeof v === 'number' && Number.isFinite(v) && v >= schema.min && v <= schema.max;
  return false;
}

// Curated chains that are known to look right together — the shuffle
// returns one of these ~30% of the time so a reroll feels designed, and
// composes fresh chains the rest of the time so it still surprises.
// Video signatures deliberately exclude realtimeSafe:false effects:
// continuous playback skips those by default, and a signature that
// silently drops half its chain isn't a signature.
const SIGNATURE_CHAINS = {
  image: [
    ['dataMosh', 'pixelSort', 'duotone'],
    ['waveWarp', 'scanline', 'hueRotate', 'bitFlip'],
    ['chanShift', 'quantize', 'lensAberration', 'stripeBurn'],
    ['void', 'pixelEcho', 'hueRotate'],
    ['levels', 'hueRotate', 'matrixColor', 'pixelEcho'],
    ['crystallize', 'edgeSketch', 'duotone'],
    ['sigil', 'displacementMap', 'invertZones'],
    ['stripeBurn', 'pixelate', 'duotone'],
    ['edgeSketch', 'pixelate', 'quantize', 'hueRotate'],
    ['wraith', 'pixelSort', 'chanShift'],
    ['anomalousSpasm', 'modularMask', 'scanline'],
    ['gaussianBlur', 'displacementMap', 'duotone'],
    ['oilPaint', 'displacementMap', 'gaussianBlur'],
    ['voronoi', 'quantize', 'duotone'],
    ['watercolorBleed', 'inkWash', 'mangaScreentone'],
    ['risograph', 'screenPrint', 'halftoneFilter'],
    ['lowPoly', 'mandala', 'leadedGlass'],
    ['cyanotype', 'duotoneGrade', 'crossStitch'],
    ['trueAscii', 'blueprint', 'woodcut'],
    ['databend', 'channelTear', 'staticBloom'],
    ['ghostTrail', 'macroblockRot', 'scanlineWarp'],
  ],
  video: [
    ['dataMosh', 'pixelSort', 'duotone'],
    ['scanline', 'waveWarp', 'hueRotate'],
    ['chanShift', 'bitFlip', 'lensAberration'],
    ['stripeBurn', 'pixelEcho', 'matrixColor'],
    ['invertZones', 'quantize', 'duotone'],
    ['edgeSketch', 'lineDistortion', 'levels'],
    ['pixelate', 'dataMosh', 'hueRotate'],
    ['lensWarp', 'scanline', 'bitFlip'],
  ],
  text: [
    ['zalgo', 'stutter', 'caseChaos'],
    ['repeatBlocks', 'scramble', 'noiseInject'],
    ['fontShuffle', 'positionDistortion', 'caseWave'],
    ['segReverse', 'lineChaos', 'marginDrift'],
    ['whitespaceBreathe', 'homoglyph', 'caseChaos'],
  ],
  audio: [
    ['bitCrush', 'tapeWobble', 'dropout'],
    ['stutter', 'noiseInject', 'echo'],
    ['granularScatter', 'outburst', 'feedback'],
    ['chunkRepeat', 'sampleCrush', 'bitCrush'],
    ['softCompress', 'subtleVibrato', 'tapeWobble'],
  ],
  web: [
    ['cssNoiseStatic', 'cssGlitchSlice', 'cssRgbSplit'],
    ['cssScanlines', 'cssVhsWobble', 'cssHueCycle'],
    ['cssDatamoshJump', 'cssInvertPulse', 'neonGlow'],
    ['filmGrain', 'cssParticleDrift', 'cssRgbSplit'],
  ],
};

function weightedCategoryPick(rng, categories, pool) {
  const weights = categories.map((c) => {
    const effects = pool.filter((e) => e.category === c);
    return effects.reduce((sum, e) => sum + getRating(e.id) * getFreshness(e.id), 0);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < categories.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return categories[i];
  }
  return categories[categories.length - 1];
}

function pickFromCategory(rng, idsByCategory, category, taken) {
  const candidates = (idsByCategory.get(category) || []).filter((id) => !taken.has(id));
  if (!candidates.length) return null;
  const weighted = candidates.map((id) => {
    return { id, weight: getRating(id) * getFreshness(id) };
  });
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let roll = rng() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.id;
  }
  return weighted[weighted.length - 1].id;
}

function ensureDifferentChain(chain, previousChain, pool, rng) {
  if (!previousChain?.length || chain.length !== previousChain.length || chain.some((id, i) => id !== previousChain[i])) return chain;
  const replacement = pool.find((effect) => !chain.includes(effect.id));
  if (!replacement) return [...chain].reverse();
  const index = Math.floor(rng() * chain.length);
  const next = [...chain];
  next[index] = replacement.id;
  return next;
}

// Picks a dynamic chain of effect ids for a media type (used by the shuffle
// button). Two modes: ~15% of rerolls return a curated SIGNATURE_CHAINS
// combo (occasionally grown with one complementary effect), the rest are
// composed fresh with pure randomness — an anchor category chosen with
// rating-weighted probabilities, then each step prefers a category different
// from the last so effects complement instead of cancelling. Never repeats
// an id within a chain.
//   options.exclude         — ids to avoid (pass the current chain so a
//                             reroll can never return the same chain twice)
//   options.signatureChance — 0..1, default 0.15 (lower = more pure randomness)
//   options.pureRandom      — if true, skip signatures entirely
//   options.realtimeOnly    — if true, exclude realtimeSafe:false effects (video)
export function randomEffectSelection(mediaType, rng, options = {}) {
  const { minCount = 2, maxCount = 4, exclude = [], previousChain = [], signatureChance = 0.15, pureRandom = false, realtimeOnly = false } = options;
  // `exclude` is a hard availability restriction for callers that need it.
  // UI rerolls use `previousChain` below: it keeps the entire palette
  // available and rejects only an identical result, fixing the old behaviour
  // where each shuffle removed its own current ingredients from future picks.
  let pool = getEffectsFor(mediaType).filter((e) => !exclude.includes(e.id));
  if (realtimeOnly) pool = pool.filter((e) => e.realtimeSafe !== false);
  if (!pool.length) return [];
  const taken = new Set(exclude);

  if (!pureRandom && rng() < signatureChance) {
    const signatures = (SIGNATURE_CHAINS[mediaType] || []).filter((chain) =>
      chain.every((id) => pool.some((e) => e.id === id)));
    if (signatures.length) {
      const chain = [...signatures[Math.floor(rng() * signatures.length)]];
      chain.forEach((id) => taken.add(id));
      const sigPool = mediaType === 'video' ? pool.filter((e) => e.realtimeSafe !== false) : pool;
      if (rng() < 0.2 && chain.length > 1) {
        const idx = Math.floor(rng() * chain.length);
        const alt = sigPool.filter((e) => !taken.has(e.id) && e.category === chain[idx] ? true : false);
        const pick = (alt.length ? alt : sigPool.filter((e) => !taken.has(e.id)))[Math.floor(rng() * (alt.length || 1))];
        if (pick) { taken.delete(chain[idx]); chain[idx] = pick.id; taken.add(pick.id); }
      }
      if (rng() < 0.25 && chain.length < maxCount) {
        const rest = sigPool.filter((e) => !taken.has(e.id));
        if (rest.length) {
          chain.push(rest[Math.floor(rng() * rest.length)].id);
        }
      }
      return ensureDifferentChain(chain, previousChain, pool, rng);
    }
  }

  const byCategory = new Map();
  for (const e of pool) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category).push(e.id);
  }
  const categories = Array.from(byCategory.keys());
  const count = Math.min(pool.length, minCount + Math.floor(rng() * (maxCount - minCount + 1)));
  const chain = [];
  let lastCategory = null;
  while (chain.length < count) {
    let category;
    if (!lastCategory || rng() < 0.15) {
      category = weightedCategoryPick(rng, categories, pool);
    } else {
      const others = categories.filter((c) => c !== lastCategory);
      category = others.length ? weightedCategoryPick(rng, others, pool) : lastCategory;
    }
    const id = pickFromCategory(rng, byCategory, category, taken);
    if (id === null) {
      const rest = pool.filter((e) => !taken.has(e.id));
      if (!rest.length) break;
      const e = rest[Math.floor(rng() * rest.length)];
      chain.push(e.id);
      taken.add(e.id);
      lastCategory = e.category;
    } else {
      chain.push(id);
      taken.add(id);
      lastCategory = category;
    }
  }
  return ensureDifferentChain(chain, previousChain, pool, rng);
}

// Video-specific chain runner. Most effects (pixel sort, datamosh, wave warp,
// channel drift...) are meant to look ALIVE frame to frame, so they get a
// seed tied to playback time — that's the whole appeal of glitching video.
// But a handful of effects use randomness to make a one-time STYLE choice
// rather than a per-frame glitch decision (duotone's hue pair, lens warp's
// bulge-vs-pinch direction, line distortion's wave shape, hue rotate's
// direction) — those are flagged `stableAcrossFrames` in their registry
// entry and get a seed tied to the clip only, so the choice holds for the
// whole video instead of flickering between random picks every frame.
// Heavy effects (oilPaint, voronoi, overlay) flagged realtimeSafe:false can
// be throttled via shouldProcessHeavy for quality tiers. Default FALSE for
// backward compatibility — continuous playback skips heavy effects.
export function applyVideoEffectChain(data, effectIds, ctx, clipSeed, frameSeed, effectParams = {}, shouldProcessHeavy = false, env = DEFAULT_ENV) {
  let result = data;
  for (const id of effectIds) {
    const effect = getEffectById(id, 'video');
    if (!effect) continue;
    if (effect.realtimeSafe === false && !shouldProcessHeavy) continue;
    const rng = prng(effect.stableAcrossFrames ? clipSeed : frameSeed);
    const params = effect.params ? sanitizeParams(effect, effectParams[id]) : undefined;
    result = effect.needsChannel
      ? effect.fn(result, ctx.W, ctx.H, ctx.intensity, ctx.channel, rng, params, env)
      : effect.fn(result, ctx.W, ctx.H, ctx.intensity, rng, params, env);
  }
  return result;
}

// Web effects generate CSS rather than transform data, so they get their
// own aggregator. `animation` contributions are merged into ONE combined
// shorthand on .gleetch-fx (comma-separated) so effects animating different
// properties genuinely run at once; effects sharing a property (see the
// composability note in effects/web/glitch.js) fall back to normal CSS
// cascade — later-selected wins for that specific property, not a crash or
// silently-dropped effect.
export function buildWebCSS(effectIds, intensity, rng, effectParams = {}) {
  const keyframeBlocks = [];
  const staticRules = [];
  const animations = [];
  for (const id of effectIds) {
    const effect = getEffectById(id, 'web');
    if (!effect) continue;
    const params = effect.params ? sanitizeParams(effect, effectParams[id]) : undefined;
    const result = effect.fn(intensity, rng, params);
    if (result.keyframes) keyframeBlocks.push(result.keyframes);
    if (result.rules) staticRules.push(result.rules);
    if (result.animation) animations.push(result.animation);
  }
  const animationRule = animations.length ? `.gleetch-fx{animation:${animations.join(', ')};}` : '';
  return [...keyframeBlocks, ...staticRules, animationRule].filter(Boolean).join('\n');
}
