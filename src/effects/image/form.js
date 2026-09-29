import { clamp } from '../../core/color.js';
import { lerpBuffer } from '../../core/blend.js';
import { hsl2rgb } from '../../core/color.js';

export function meshGradient(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  const points = [];
  for (let i = 0; i < 4; i++) {
    points.push({ x: rng() * W, y: rng() * H, hue: rng() * 360 });
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let totalW = 0, r = 0, g = 0, b = 0;
      for (const p of points) {
        const d = Math.hypot(x - p.x, y - p.y);
        const w = 1 / (1 + d * 0.05);
        const [pr, pg, pb] = hsl2rgb(p.hue, 0.7, 0.55);
        r += pr * w; g += pg * w; b += pb * w; totalW += w;
      }
      const i = (y * W + x) * 4;
      full[i] = clamp(buf[i] * (1 - intensity * 0.6) + (r / totalW) * intensity * 0.6, 0, 255);
      full[i + 1] = clamp(buf[i + 1] * (1 - intensity * 0.6) + (g / totalW) * intensity * 0.6, 0, 255);
      full[i + 2] = clamp(buf[i + 2] * (1 - intensity * 0.6) + (b / totalW) * intensity * 0.6, 0, 255);
      full[i + 3] = 255;
    }
  }
  return full;
}

export function frostedGlass(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  const radius = Math.max(2, Math.round(6 * intensity));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = clamp(x + dx, 0, W - 1), ny = clamp(y + dy, 0, H - 1);
          const i = (ny * W + nx) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; count++;
        }
      }
      const i = (y * W + x) * 4;
      full[i] = r / count; full[i + 1] = g / count; full[i + 2] = b / count; full[i + 3] = 255;
    }
  }
  return lerpBuffer(buf, full, intensity * 0.7);
}

export function tiltShift(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf);
  const focusY = H / 2;
  const blurAmount = intensity * 8;
  for (let y = 0; y < H; y++) {
    const dist = Math.abs(y - focusY) / (H / 2);
    const blur = dist * blurAmount;
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      const r2 = Math.max(1, Math.round(blur));
      for (let dy = -r2; dy <= r2; dy++) {
        const ny = clamp(y + dy, 0, H - 1);
        const i = (ny * W + x) * 4;
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; count++;
      }
      const i = (y * W + x) * 4;
      full[i] = r / count; full[i + 1] = g / count; full[i + 2] = b / count; full[i + 3] = 255;
    }
  }
  return full;
}

export const FORM_EFFECTS = [
  { id: 'meshGradient', label: 'MESH GRADIENT', hint: 'silky liquid color blobs', category: 'form', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: meshGradient },
  { id: 'frostedGlass', label: 'FROSTED GLASS', hint: 'soft blur distortion', category: 'form', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: frostedGlass },
  { id: 'tiltShift', label: 'TILT SHIFT', hint: 'miniature focus blur', category: 'finish', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: tiltShift },
];
