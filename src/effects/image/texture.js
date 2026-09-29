import { clamp } from '../../core/color.js';

function luma(buf, i) {
  return buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11;
}

export function filmGrain(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    const l = luma(buf, i);
    const grain = (rng() - 0.5) * intensity * 40 * (1 - l / 255);
    full[i] = clamp(buf[i] + grain, 0, 255);
    full[i + 1] = clamp(buf[i + 1] + grain, 0, 255);
    full[i + 2] = clamp(buf[i + 2] + grain, 0, 255);
    full[i + 3] = 255;
  }
  return full;
}

export function paperFiber(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fiber = Math.sin(x * 0.3 + rng() * 0.1) * Math.cos(y * 0.3 + rng() * 0.1) * intensity * 15;
      const i = (y * W + x) * 4;
      full[i] = clamp(buf[i] + fiber, 0, 255);
      full[i + 1] = clamp(buf[i + 1] + fiber, 0, 255);
      full[i + 2] = clamp(buf[i + 2] + fiber, 0, 255);
      full[i + 3] = 255;
    }
  }
  return full;
}

export function dustScratch(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf);
  const scratches = Math.floor(intensity * 20);
  for (let s = 0; s < scratches; s++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H);
    const len = Math.floor(rng() * 50) + 10;
    const horizontal = rng() > 0.5;
    for (let i = 0; i < len; i++) {
      const px = horizontal ? x + i : x;
      const py = horizontal ? y : y + i;
      if (px >= W || py >= H) break;
      const idx = (py * W + px) * 4;
      const v = rng() > 0.5 ? 255 : 0;
      full[idx] = v; full[idx + 1] = v; full[idx + 2] = v; full[idx + 3] = 255;
    }
  }
  return full;
}

export const TEXTURE_EFFECTS = [
  { id: 'filmGrain', label: 'FILM GRAIN', hint: 'luma-weighted noise', category: 'texture', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: filmGrain },
  { id: 'paperFiber', label: 'PAPER FIBER', hint: 'subtle paper texture', category: 'texture', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: paperFiber },
  { id: 'dustScratch', label: 'DUST SCRATCH', hint: 'film dust and scratches', category: 'texture', mediaTypes: ['image', 'video'], realtimeSafe: true, fn: dustScratch },
];
