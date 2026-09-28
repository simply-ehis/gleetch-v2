import { clamp } from './color.js';

function blendChannel(a, b, mode) {
  switch (mode) {
    case 'screen': return 255 - ((255 - a) * (255 - b)) / 255;
    case 'multiply': return (a * b) / 255;
    case 'overlay': return a < 128 ? (2 * a * b) / 255 : 255 - (2 * (255 - a) * (255 - b)) / 255;
    case 'soft-light': return b < 128 ? a - (1 - 2 * b / 255) * a * (1 - a / 255) : a + (2 * b / 255 - 1) * (Math.sqrt(a / 255) * 255 - a);
    case 'hard-light': return b < 128 ? (2 * a * b) / 255 : 255 - (2 * (255 - a) * (255 - b)) / 255;
    case 'color-dodge': return b >= 255 ? 255 : clamp((a * 255) / (255 - b), 0, 255);
    case 'color-burn': return b <= 0 ? 0 : 255 - clamp(((255 - a) * 255) / b, 0, 255);
    case 'lighten': return Math.max(a, b);
    case 'darken': return Math.min(a, b);
    case 'difference': return Math.abs(a - b);
    case 'exclusion': return a + b - (2 * a * b) / 255;
    case 'hue': return a;
    case 'saturation': return a;
    case 'color': return b;
    case 'luminosity': return a;
    default: return b;
  }
}

export function blendWith(base, fx, { mode = 'screen', opacity = 0.5, mask = null } = {}) {
  if (opacity <= 0) return new Uint8ClampedArray(base);
  if (opacity >= 1 && !mask) return new Uint8ClampedArray(fx);
  const out = new Uint8ClampedArray(base.length);
  for (let i = 0; i < base.length; i += 4) {
    let m = opacity;
    if (mask) m *= mask[i / 4] ?? 1;
    if (m <= 0) {
      out[i] = base[i]; out[i + 1] = base[i + 1]; out[i + 2] = base[i + 2]; out[i + 3] = base[i + 3];
    } else if (m >= 1) {
      out[i] = fx[i]; out[i + 1] = fx[i + 1]; out[i + 2] = fx[i + 2]; out[i + 3] = fx[i + 3];
    } else {
      out[i] = clamp(base[i] * (1 - m) + blendChannel(base[i], fx[i], mode) * m, 0, 255);
      out[i + 1] = clamp(base[i + 1] * (1 - m) + blendChannel(base[i + 1], fx[i + 1], mode) * m, 0, 255);
      out[i + 2] = clamp(base[i + 2] * (1 - m) + blendChannel(base[i + 2], fx[i + 2], mode) * m, 0, 255);
      out[i + 3] = clamp(base[i + 3] * (1 - m) + fx[i + 3] * m, 0, 255);
    }
  }
  return out;
}

export function luminanceMask(buf, W, H, invert = false) {
  const mask = new Float32Array(W * H);
  for (let i = 0, p = 0; i < buf.length; i += 4, p++) {
    const l = (buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11) / 255;
    mask[p] = invert ? 1 - l : l;
  }
  return mask;
}

export function radialMask(W, H, cx = 0.5, cy = 0.5, radius = 0.5) {
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x / W - cx) / radius;
      const dy = (y / H - cy) / radius;
      const d = Math.sqrt(dx * dx + dy * dy);
      mask[y * W + x] = clamp(1 - d, 0, 1);
    }
  }
  return mask;
}

export function noiseMask(W, H, seed, scale = 4) {
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = Math.sin(x * scale * 0.1 + seed) * Math.cos(y * scale * 0.1 + seed * 1.3);
      mask[y * W + x] = n * 0.5 + 0.5;
    }
  }
  return mask;
}
