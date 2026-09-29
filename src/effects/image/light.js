import { clamp } from '../../core/color.js';
import { lerpBuffer } from '../../core/blend.js';

export function bloom(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  const radius = Math.max(2, Math.round(8 * intensity));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = clamp(x + dx, 0, W - 1), ny = clamp(y + dy, 0, H - 1);
          const i = (ny * W + nx) * 4;
          const w = 1 / (1 + Math.hypot(dx, dy));
          r += buf[i] * w; g += buf[i + 1] * w; b += buf[i + 2] * w; count += w;
        }
      }
      const i = (y * W + x) * 4;
      full[i] = clamp(buf[i] + (r / count - buf[i]) * intensity * 0.5, 0, 255);
      full[i + 1] = clamp(buf[i + 1] + (g / count - buf[i + 1]) * intensity * 0.5, 0, 255);
      full[i + 2] = clamp(buf[i + 2] + (b / count - buf[i + 2]) * intensity * 0.5, 0, 255);
      full[i + 3] = 255;
    }
  }
  return lerpBuffer(buf, full, intensity);
}

export function lightLeak(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf);
  const cx = rng() * W, cy = rng() * H;
  const maxDist = Math.hypot(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxDist;
      const leak = Math.max(0, 1 - d * 2) * intensity;
      const i = (y * W + x) * 4;
      full[i] = clamp(buf[i] + leak * 80, 0, 255);
      full[i + 1] = clamp(buf[i + 1] + leak * 40, 0, 255);
      full[i + 2] = clamp(buf[i + 2] + leak * 20, 0, 255);
    }
  }
  return full;
}

export function vignette(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf);
  const cx = W / 2, cy = H / 2;
  const maxDist = Math.hypot(cx, cy);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxDist;
      const v = 1 - d * d * intensity;
      const i = (y * W + x) * 4;
      full[i] = clamp(buf[i] * v, 0, 255);
      full[i + 1] = clamp(buf[i + 1] * v, 0, 255);
      full[i + 2] = clamp(buf[i + 2] * v, 0, 255);
    }
  }
  return full;
}

export const LIGHT_EFFECTS = [
  { id: 'bloom', label: 'BLOOM', hint: 'soft glow around bright areas', category: 'light', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: bloom },
  { id: 'lightLeak', label: 'LIGHT LEAK', hint: 'warm film leak from edge', category: 'light', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: lightLeak },
  { id: 'vignette', label: 'VIGNETTE', hint: 'darkened corners', category: 'finish', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: vignette },
];
