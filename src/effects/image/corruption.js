import { clamp } from '../../core/color.js';
import { lerpBuffer } from '../../core/blend.js';

function getSortVal(buf, i, ch) {
  return ch === 'r' ? buf[i] : ch === 'g' ? buf[i + 1] : ch === 'b' ? buf[i + 2]
    : buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11;
}

export function pixelSort(buf, W, H, intensity, channel, rng) {
  const out = new Uint8ClampedArray(buf);
  const thresh = 255 * (1 - intensity * 0.88);
  const vertical = rng() < 0.35;

  const sortRuns = (getIdx, outerMax, innerMax) => {
    for (let outer = 0; outer < outerMax; outer++) {
      let start = -1;
      for (let inner = 0; inner <= innerMax; inner++) {
        const idx = getIdx(outer, inner) * 4;
        const active = inner < innerMax && getSortVal(buf, idx, channel) > thresh;
        if (active && start === -1) {
          start = inner;
        } else if (!active && start !== -1) {
          const segment = [];
          for (let k = start; k < inner; k++) {
            const si = getIdx(outer, k) * 4;
            segment.push([buf[si], buf[si + 1], buf[si + 2], buf[si + 3], getSortVal(buf, si, channel)]);
          }
          segment.sort((a, b) => a[4] - b[4]);
          segment.forEach((p, j) => {
            const di = getIdx(outer, start + j) * 4;
            out[di] = p[0]; out[di + 1] = p[1]; out[di + 2] = p[2]; out[di + 3] = p[3];
          });
          start = -1;
        }
      }
    }
  };

  if (!vertical) sortRuns((y, x) => y * W + x, H, W);
  else sortRuns((x, y) => y * W + x, W, H);
  return out;
}

export function chanShift(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf.length);
  const maxShift = Math.floor(intensity * W * 0.13);
  const rs = Math.floor((rng() * 2 - 1) * maxShift);
  const gs = Math.floor((rng() * 2 - 1) * maxShift);
  const bs = Math.floor((rng() * 2 - 1) * maxShift);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      out[i] = buf[(y * W + (((x + rs) % W) + W) % W) * 4];
      out[i + 1] = buf[(y * W + (((x + gs) % W) + W) % W) * 4 + 1];
      out[i + 2] = buf[(y * W + (((x + bs) % W) + W) % W) * 4 + 2];
      out[i + 3] = 255;
    }
  }
  return out;
}

export function scanline(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const maxShift = Math.floor(intensity * W * 0.11);
  for (let y = 0; y < H; y++) {
    if (rng() < intensity * 0.38) {
      const shift = Math.floor((rng() * 2 - 1) * maxShift);
      for (let x = 0; x < W; x++) {
        const d = (y * W + x) * 4;
        const s = (y * W + (((x - shift) % W) + W) % W) * 4;
        out[d] = buf[s]; out[d + 1] = buf[s + 1]; out[d + 2] = buf[s + 2]; out[d + 3] = buf[s + 3];
      }
    }
  }
  return out;
}

export function bitFlip(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const n = Math.floor(intensity * W * H * 0.04);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * W * H) * 4 + Math.floor(rng() * 3);
    out[idx] ^= 1 << Math.floor(rng() * 8);
  }
  return out;
}

export function dataMosh(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const n = Math.floor(intensity * 10);
  for (let b = 0; b < n; b++) {
    const bh = Math.floor(5 + rng() * H * 0.13);
    const sy = Math.floor(rng() * (H - bh));
    const dy = Math.floor(rng() * (H - bh));
    for (let row = 0; row < bh; row++) {
      const sr = (sy + row) * W * 4, dr = (dy + row) * W * 4;
      for (let px = 0; px < W * 4; px++) out[dr + px] = buf[sr + px];
    }
  }
  return out;
}

export function waveWarp(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf.length);
  const amp = Math.floor(intensity * W * 0.08);
  const freq = 2 + rng() * 5, phase = rng() * Math.PI * 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const sy = clamp(Math.round(y + Math.sin((x / W) * freq * Math.PI * 2 + phase) * amp), 0, H - 1);
      const sx = clamp(Math.round(x + Math.cos((y / H) * freq * Math.PI * 2 + phase) * amp * 0.5), 0, W - 1);
      const s = (sy * W + sx) * 4;
      out[i] = buf[s]; out[i + 1] = buf[s + 1]; out[i + 2] = buf[s + 2]; out[i + 3] = buf[s + 3];
    }
  }
  return out;
}

export function invertZones(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const n = Math.floor(intensity * 8);
  for (let i = 0; i < n; i++) {
    const x1 = rng() * W | 0, y1 = rng() * H | 0;
    const w = rng() * W * 0.4 | 0, h = rng() * H * 0.4 | 0;
    for (let y = y1; y < Math.min(y1 + h, H); y++) {
      for (let x = x1; x < Math.min(x1 + w, W); x++) {
        const idx = (y * W + x) * 4;
        out[idx] = 255 - out[idx]; out[idx + 1] = 255 - out[idx + 1]; out[idx + 2] = 255 - out[idx + 2];
      }
    }
  }
  return out;
}

export function quantize(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const levels = 2;
  const step = 256 / levels;
  const full = new Uint8ClampedArray(buf);
  for (let i = 0; i < full.length; i += 4) {
    full[i] = Math.floor(full[i] / step) * step;
    full[i + 1] = Math.floor(full[i + 1] / step) * step;
    full[i + 2] = Math.floor(full[i + 2] / step) * step;
  }
  if (intensity >= 1) return full;
  return lerpBuffer(buf, full, intensity);
}

export function stripeBurn(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf);
  const n = Math.floor(intensity * 20);
  for (let i = 0; i < n; i++) {
    if (rng() < 0.5) {
      const y = rng() * H | 0, sy = rng() * H | 0, reps = 1 + rng() * 5 | 0;
      for (let dy = 0; dy < reps && y + dy < H; dy++) {
        for (let x = 0; x < W * 4; x++) out[(y + dy) * W * 4 + x] = buf[sy * W * 4 + x];
      }
    } else {
      const ch = rng() * 3 | 0, y = rng() * H | 0, bh = 1 + rng() * 10 | 0;
      for (let dy = 0; dy < bh && y + dy < H; dy++) {
        for (let x = 0; x < W; x++) {
          const idx = (y + dy) * W * 4 + x * 4;
          out[idx + ch] = Math.min(255, out[idx + ch] * (1.5 + rng()));
        }
      }
    }
  }
  return out;
}

export function pixelEcho(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const out = new Uint8ClampedArray(buf);
  const echoes = Math.floor(intensity * 5);
  for (let e = 0; e < echoes; e++) {
    const ox = Math.floor((rng() * 2 - 1) * W * 0.15);
    const oy = Math.floor((rng() * 2 - 1) * H * 0.15);
    const alpha = 0.2 + rng() * 0.3, ch = rng() * 3 | 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sy = clamp(y + oy, 0, H - 1), sx = clamp(x + ox, 0, W - 1);
        const di = (y * W + x) * 4, si = (sy * W + sx) * 4;
        for (let c = 0; c < 3; c++) {
          out[di + c] = clamp(out[di + c] + buf[si + c] * alpha * (c === ch ? 1.5 : 0.3) | 0, 0, 255);
        }
      }
    }
  }
  return out;
}

export const CORRUPTION_EFFECTS = [
  { id: 'pixelSort', label: 'PIXEL SORT', hint: 'segment-sorted by channel', category: 'corruption', mediaTypes: ['image', 'video'], needsChannel: true, slot: 'distortion', cost: 3, motion: { kind: 'steps', target: 'threshold', speed: 0.4 }, fn: pixelSort },
  { id: 'chanShift', label: 'CHANNEL DRIFT', hint: 'RGB layers offset apart', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'distortion', cost: 1, motion: { kind: 'drift', target: 'offset', speed: 0.15 }, fn: chanShift },
  { id: 'scanline', label: 'SCANLINE RIP', hint: 'random row displacement', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'texture', cost: 1, motion: { kind: 'drift', target: 'offset', speed: 0.2 }, fn: scanline },
  { id: 'bitFlip', label: 'BIT FLIP', hint: 'raw entropy injection', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'noise', cost: 1, motion: { kind: 'burst', target: 'density', speed: 1.2 }, fn: bitFlip },
  { id: 'dataMosh', label: 'DATAMOSH', hint: 'block duplication smear', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'warp', cost: 2, motion: { kind: 'burst', target: 'intensity', speed: 0.8 }, fn: dataMosh },
  { id: 'waveWarp', label: 'WAVE WARP', hint: 'sine wave distortion', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'warp', cost: 2, motion: { kind: 'pulse', target: 'amplitude', speed: 0.25 }, fn: waveWarp },
  { id: 'invertZones', label: 'INVERT ZONES', hint: 'random region inversion', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'colour', cost: 1, motion: { kind: 'burst', target: 'intensity', speed: 0.5 }, fn: invertZones },
  { id: 'quantize', label: 'QUANTIZE', hint: 'color level reduction', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'colour', cost: 1, motion: { kind: 'steps', target: 'levels', speed: 0.2 }, fn: quantize },
  { id: 'stripeBurn', label: 'STRIPE BURN', hint: 'horizontal streak repeat', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'distortion', cost: 2, motion: { kind: 'steps', target: 'position', speed: 0.3 }, fn: stripeBurn },
  { id: 'pixelEcho', label: 'PIXEL ECHO', hint: 'ghost channel overlay', category: 'corruption', mediaTypes: ['image', 'video'], slot: 'overlay', cost: 2, motion: { kind: 'drift', target: 'offset', speed: 0.1 }, fn: pixelEcho },
];
