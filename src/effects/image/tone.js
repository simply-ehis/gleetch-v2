import { clamp, hsl2rgb } from '../../core/color.js';
import { lerpBuffer } from '../../core/blend.js';
import { CURATED_PALETTES } from '../../core/palette.js';

function luma(buf, i) {
  return buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11;
}

export function gradientMap(buf, W, H, intensity, rng, params) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const paletteIdx = params?.palette ?? 0;
  const palette = CURATED_PALETTES[paletteIdx]?.colors ?? CURATED_PALETTES[0].colors;
  const full = new Uint8ClampedArray(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    const l = luma(buf, i) / 255;
    const idx = Math.min(palette.length - 1, Math.floor(l * palette.length));
    const c = palette[idx];
    full[i] = c[0]; full[i + 1] = c[1]; full[i + 2] = c[2]; full[i + 3] = 255;
  }
  return lerpBuffer(buf, full, intensity);
}

export function splitTone(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    const l = luma(buf, i) / 255;
    const shadowR = 20, shadowG = 40, shadowB = 80;
    const highlightR = 255, highlightG = 220, highlightB = 180;
    full[i] = clamp(shadowR + (highlightR - shadowR) * l, 0, 255);
    full[i + 1] = clamp(shadowG + (highlightG - shadowG) * l, 0, 255);
    full[i + 2] = clamp(shadowB + (highlightB - shadowB) * l, 0, 255);
    full[i + 3] = 255;
  }
  return lerpBuffer(buf, full, intensity);
}

export function iridescence(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  const hueShift = rng() * 360;
  for (let i = 0; i < buf.length; i += 4) {
    const l = luma(buf, i) / 255;
    const hue = (hueShift + l * 120) % 360;
    const [r, g, b] = hsl2rgb(hue, 0.6, 0.5);
    full[i] = clamp(buf[i] * (1 - intensity * 0.5) + r * intensity * 0.5, 0, 255);
    full[i + 1] = clamp(buf[i + 1] * (1 - intensity * 0.5) + g * intensity * 0.5, 0, 255);
    full[i + 2] = clamp(buf[i + 2] * (1 - intensity * 0.5) + b * intensity * 0.5, 0, 255);
    full[i + 3] = 255;
  }
  return full;
}

export const TONE_EFFECTS = [
  {
    id: 'gradientMap', label: 'GRADIENT MAP', hint: 'map luminance to curated palette', category: 'tone', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: gradientMap,
    params: [
      { key: 'palette', type: 'select', label: 'PALETTE', default: 0, options: CURATED_PALETTES.map((p, i) => ({ value: i, label: p.name })) },
    ],
  },
  { id: 'splitTone', label: 'SPLIT TONE', hint: 'warm highlights, cool shadows', category: 'tone', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: splitTone },
  { id: 'iridescence', label: 'IRIDESCENCE', hint: 'oil-slick color shift', category: 'tone', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: iridescence },
];
