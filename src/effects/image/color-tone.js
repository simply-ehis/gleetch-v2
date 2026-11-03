import { clamp, hsl2rgb } from '../../core/color.js';

// Stretches the contrast between a black point and white point (intensity
// controls how aggressive the stretch is). Classic "levels" adjustment.
export function levels(buf, W, H, intensity) {
  const out = new Uint8ClampedArray(buf);
  const black = intensity * 60;
  const white = 255 - intensity * 60;
  const range = Math.max(1, white - black);
  for (let i = 0; i < out.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      out[i + c] = clamp(((out[i + c] - black) / range) * 255, 0, 255);
    }
  }
  return out;
}

// Maps luminance to a gradient between two hues (dark -> shadowHue, light -> highlightHue).
export function duotone(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const shadowHue = rng() * 360;
  const highlightHue = (shadowHue + 140 + rng() * 80) % 360;
  for (let i = 0; i < out.length; i += 4) {
    const luma = (buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11) / 255;
    const [r, g, b] = hsl2rgb(shadowHue + (highlightHue - shadowHue) * luma, 65, luma * 90);
    out[i] = out[i] * (1 - intensity) + r * intensity;
    out[i + 1] = out[i + 1] * (1 - intensity) + g * intensity;
    out[i + 2] = out[i + 2] * (1 - intensity) + b * intensity;
  }
  return out;
}

// Clean radial chromatic aberration — offset increases toward the frame edges,
// like a real lens, rather than the uniform random offset of CHANNEL DRIFT.
export function lensAberration(buf, W, H, intensity) {
  const out = new Uint8ClampedArray(buf.length);
  const cx = W / 2, cy = H / 2;
  const maxShift = intensity * Math.min(W, H) * 0.05;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / cx, dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const shift = Math.round(dist * maxShift);
      const i = (y * W + x) * 4;
      const rx = clamp(x + shift, 0, W - 1), bx = clamp(x - shift, 0, W - 1);
      out[i] = buf[(y * W + rx) * 4];
      out[i + 1] = buf[i + 1];
      out[i + 2] = buf[(y * W + bx) * 4 + 2];
      out[i + 3] = 255;
    }
  }
  return out;
}

// Rotates every pixel's hue by a fixed amount — intensity controls the degrees (0-360).
export function hueRotate(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const degrees = intensity * 360 * (rng() < 0.5 ? 1 : -1);
  const rad = (degrees * Math.PI) / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  // Standard hue-rotation matrix (luminance-preserving)
  const m = [
    0.213 + cosA * 0.787 - sinA * 0.213, 0.715 - cosA * 0.715 - sinA * 0.715, 0.072 - cosA * 0.072 + sinA * 0.928,
    0.213 - cosA * 0.213 + sinA * 0.143, 0.715 + cosA * 0.285 + sinA * 0.140, 0.072 - cosA * 0.072 - sinA * 0.283,
    0.213 - cosA * 0.213 - sinA * 0.787, 0.715 - cosA * 0.715 + sinA * 0.715, 0.072 + cosA * 0.928 + sinA * 0.072,
  ];
  for (let i = 0; i < out.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    out[i] = clamp(r * m[0] + g * m[1] + b * m[2], 0, 255);
    out[i + 1] = clamp(r * m[3] + g * m[4] + b * m[5], 0, 255);
    out[i + 2] = clamp(r * m[6] + g * m[7] + b * m[8], 0, 255);
  }
  return out;
}

export const COLOR_TONE_EFFECTS = [
  { id: 'levels', label: 'LEVELS', hint: 'contrast stretch', category: 'color-tone', mediaTypes: ['image', 'video'], slot: 'colour', cost: 1, motion: { kind: 'sweep', target: 'levels', speed: 0.2 }, fn: levels },
  { id: 'duotone', label: 'DUOTONE', hint: 'two-hue luminance map', category: 'color-tone', mediaTypes: ['image', 'video'], stableAcrossFrames: true, slot: 'colour', cost: 1, motion: { kind: 'sweep', target: 'huePair', speed: 0.1 }, fn: duotone },
  { id: 'lensAberration', label: 'LENS ABERRATION', hint: 'clean radial color fringe', category: 'color-tone', mediaTypes: ['image', 'video'], slot: 'distortion', cost: 1, motion: { kind: 'breathe', target: 'fringe', speed: 0.12 }, fn: lensAberration },
  { id: 'hueRotate', label: 'HUE ROTATE', hint: 'shift all hues', category: 'color-tone', mediaTypes: ['image', 'video'], stableAcrossFrames: true, slot: 'colour', cost: 1, motion: { kind: 'sweep', target: 'angle', speed: 0.08 }, fn: hueRotate },
  {
    id: 'matrixColor', label: 'MATRIX COLOR', hint: 'color-space remap + posterize', category: 'color-tone', mediaTypes: ['image', 'video'], stableAcrossFrames: true, slot: 'colour', cost: 2, motion: { kind: 'drift', target: 'palette', speed: 0.12 }, fn: matrixColor,
    params: [
      { key: 'colorMode', type: 'select', label: 'MODE', default: 'cyberTint', options: [
        { value: 'none', label: 'Native' }, { value: 'cyberTint', label: 'Cyber Tint' }, { value: 'monochrome', label: 'Monochrome' },
        { value: 'thermal', label: 'Thermal' }, { value: 'solarize', label: 'Solarize' }, { value: 'sineGradient', label: 'Sine Remap' },
      ] },
      { key: 'levels', type: 'range', label: 'LEVELS', default: 64, min: 2, max: 64, step: 1 },
    ],
  },
];

// Color-space remap operators shared between matrixColor (below) and the
// pareidolia displacement family (pareidolia.js) — one implementation,
// two consumers. Ported from the "Color Math" section of the reference
// pareidolia engine, kept exactly as-is including its quirks (the
// time-modulated sine curves in monochrome/sineGradient are what make
// those modes "dynamic" on re-roll/video-frame).
const THERMAL_GRADIENTS = [
  { r: 0, g: 0, b: 50 },       // blackish blue
  { r: 0, g: 0, b: 180 },      // deep blue
  { r: 0, g: 150, b: 220 },    // cyan
  { r: 30, g: 180, b: 30 },    // green
  { r: 240, g: 220, b: 0 },    // yellow
  { r: 250, g: 60, b: 0 },     // orange
  { r: 255, g: 255, b: 255 },  // white-hot
];

export function applyColorRemap(mode, r, g, b, luma, time) {
  switch (mode) {
    case 'monochrome': {
      const v = Math.sin((luma / 255) * Math.PI * 2 - time) * 127.5 + 127.5;
      return [v, v, v];
    }
    case 'cyberTint': {
      // The reference's cyberTint is fully static (luma-only tint); the
      // gentle green pulse is the one deliberate deviation — without it the
      // mode ignores `time` entirely and matrixColor would render
      // identically across clips (violating the per-clip style-pick rule).
      const pulse = Math.sin(time * 0.05 + luma * 0.02) * 14;
      return [luma * 1.2, luma * 0.4 + pulse, luma * 1.5];
    }
    case 'thermal': {
      const n = Math.max(0, Math.min(1, luma / 255));
      const idx = Math.floor(n * (THERMAL_GRADIENTS.length - 1));
      const next = Math.min(THERMAL_GRADIENTS.length - 1, idx + 1);
      const t = n * (THERMAL_GRADIENTS.length - 1) - idx;
      const c1 = THERMAL_GRADIENTS[idx], c2 = THERMAL_GRADIENTS[next];
      return [c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t];
    }
    case 'solarize':
      return [r > 128 ? 255 - r : r, g > 128 ? 255 - g : g, b > 128 ? 255 - b : b];
    case 'sineGradient':
      return [
        Math.sin((r / 255) * Math.PI * 3 + time) * 127 + 128,
        Math.sin((g / 255) * Math.PI * 2 + time + 1) * 127 + 128,
        Math.sin((b / 255) * Math.PI * 4 + time + 2) * 127 + 128,
      ];
    default:
      return [r, g, b];
  }
}

// The reference engine's "Color Math" section as a standalone effect:
// color-space remap + optional posterization, no displacement. Cheap
// (single pass, no sampling/atan2/pow), so unlike the pareidolia family
// it IS realtime-safe for video playback.
// Intensity is the effect's strength, consistent with the rest of the
// library: at 0 the output is the input (no remap, no posterize), ramping
// up to the full remap and the declared LEVELS at 1.
export function matrixColor(buf, W, H, intensity, rng, params) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const mode = params?.colorMode ?? 'cyberTint';
  const levels = params?.levels ?? 64;
  const effLevels = Math.round(64 - (64 - levels) * intensity);
  const time = rng() * 100;
  const out = new Uint8ClampedArray(buf);
  for (let i = 0; i < out.length; i += 4) {
    const sr = out[i], sg = out[i + 1], sb = out[i + 2];
    let r = sr, g = sg, b = sb;
    if (mode !== 'none') {
      const luma = sr * 0.299 + sg * 0.587 + sb * 0.114;
      const [mr, mg, mb] = applyColorRemap(mode, sr, sg, sb, luma, time);
      r = sr + (mr - sr) * intensity;
      g = sg + (mg - sg) * intensity;
      b = sb + (mb - sb) * intensity;
    }
    if (effLevels < 64) {
      r = Math.round(r / 255 * effLevels) * (255 / effLevels);
      g = Math.round(g / 255 * effLevels) * (255 / effLevels);
      b = Math.round(b / 255 * effLevels) * (255 / effLevels);
    }
    out[i] = clamp(r, 0, 255);
    out[i + 1] = clamp(g, 0, 255);
    out[i + 2] = clamp(b, 0, 255);
  }
  return out;
}
