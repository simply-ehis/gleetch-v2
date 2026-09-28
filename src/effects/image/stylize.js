import { clamp, hsl2rgb, hexToRgb } from '../../core/color.js';
import { lerpBuffer } from '../../core/blend.js';

function luma(buf, i) {
  return buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11;
}

// Classic newsprint halftone: darker cells get bigger dots, on a white ground.
export function halftoneFilter(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length).fill(255);
  const cell = Math.max(4, Math.round(20 - intensity * 14));
  for (let by = 0; by < H; by += cell) {
    for (let bx = 0; bx < W; bx += cell) {
      let r = 0, g = 0, b = 0, l = 0, count = 0;
      const bh = Math.min(cell, H - by), bw = Math.min(cell, W - bx);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = ((by + y) * W + (bx + x)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; l += luma(buf, i); count++;
        }
      }
      r /= count; g /= count; b /= count; l /= count;
      const radius = (1 - l / 255) * cell * 0.55;
      const ccx = bx + bw / 2, ccy = by + bh / 2;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const px = bx + x, py = by + y;
          const dist = Math.hypot(px - ccx, py - ccy);
          if (dist <= radius) {
            const i = (py * W + px) * 4;
            full[i] = r; full[i + 1] = g; full[i + 2] = b; full[i + 3] = 255;
          }
        }
      }
    }
  }
  if (intensity >= 1) return full;
  return lerpBuffer(buf, full, intensity);
}

// Sobel edge detection rendered as a pencil sketch (dark lines on white).
export function edgeSketch(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  const gray = new Float32Array(W * H);
  for (let i = 0, p = 0; i < buf.length; i += 4, p++) gray[p] = luma(buf, i);

  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sx = 0, sy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = clamp(x + dx, 0, W - 1), ny = clamp(y + dy, 0, H - 1);
          const v = gray[ny * W + nx];
          sx += v * gx[k]; sy += v * gy[k]; k++;
        }
      }
      const mag = Math.sqrt(sx * sx + sy * sy);
      const shade = clamp(255 - mag * (0.5 + 1 * 1.5), 0, 255);
      const i = (y * W + x) * 4;
      full[i] = full[i + 1] = full[i + 2] = shade; full[i + 3] = 255;
    }
  }
  if (intensity >= 1) return full;
  return lerpBuffer(buf, full, intensity);
}

// Oil-paint mode filter: each pixel becomes the average color of the most
// common luminance bucket in its neighborhood (Costa-style oil paint).
export function oilPaint(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length);
  const radius = 5;
  const levels = 16;
  const bucketCount = new Int32Array(levels);
  const bucketR = new Int32Array(levels);
  const bucketG = new Int32Array(levels);
  const bucketB = new Int32Array(levels);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      bucketCount.fill(0); bucketR.fill(0); bucketG.fill(0); bucketB.fill(0);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = clamp(x + dx, 0, W - 1), ny = clamp(y + dy, 0, H - 1);
          const i = (ny * W + nx) * 4;
          const bucket = Math.min(levels - 1, (luma(buf, i) / 256 * levels) | 0);
          bucketCount[bucket]++; bucketR[bucket] += buf[i]; bucketG[bucket] += buf[i + 1]; bucketB[bucket] += buf[i + 2];
        }
      }
      let best = 0;
      for (let b = 1; b < levels; b++) if (bucketCount[b] > bucketCount[best]) best = b;
      const di = (y * W + x) * 4;
      const n = Math.max(1, bucketCount[best]);
      full[di] = bucketR[best] / n; full[di + 1] = bucketG[best] / n; full[di + 2] = bucketB[best] / n; full[di + 3] = 255;
    }
  }
  if (intensity >= 1) return full;
  return lerpBuffer(buf, full, intensity);
}

// Circle-packed mosaic: same grid-cell structure as halftoneFilter, but
// UNIFORM dot size instead of brightness-driven radius — a flat, evenly
// spaced "beadboard" mosaic rather than a tonal newsprint halftone. Fully
// deterministic (no rng): dots sit on a fixed lattice derived only from
// W/H/cell, never jittered, so the grid reads as aligned/structured.
export function dotMosaic(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const full = new Uint8ClampedArray(buf.length).fill(255);
  const cell = Math.max(4, Math.round(20 - 1 * 14));
  const radius = cell * 0.58; // >cell/2 so neighboring dots touch/slightly overlap
  for (let by = 0; by < H; by += cell) {
    const bh = Math.min(cell, H - by);
    for (let bx = 0; bx < W; bx += cell) {
      const bw = Math.min(cell, W - bx);
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = ((by + y) * W + (bx + x)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; count++;
        }
      }
      r /= count; g /= count; b /= count;
      const ccx = bx + bw / 2, ccy = by + bh / 2;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const px = bx + x, py = by + y;
          const dist = Math.hypot(px - ccx, py - ccy);
          if (dist <= radius) {
            const i = (py * W + px) * 4;
            full[i] = r; full[i + 1] = g; full[i + 2] = b; full[i + 3] = 255;
          }
        }
      }
    }
  }
  if (intensity >= 1) return full;
  return lerpBuffer(buf, full, intensity);
}

// Built-in multi-color mode palette — Gleetch's own accent pair (cyan,
// pink) extended with two complementary hues, so the default look belongs
// to the app's own identity rather than an arbitrary color choice.
const ASCII_PALETTE = [[0, 229, 255], [255, 45, 107], [150, 80, 255], [80, 255, 160]];

// ASCII-density placement: same size-by-darkness logic as halftoneFilter
// (dark = big mark, light = small/none), which is the actual mechanism
// real ASCII art uses to pick a dense vs. sparse character per region.
// Unlike halftoneFilter/dotMosaic, color here is completely decoupled
// from the source image — single/palette/random via the colorMode param,
// picked with the seeded rng (never Math.random()) so a shared recipe
// reproduces exactly. Also unlike the other two, near-white cells are
// skipped entirely rather than drawn as a tiny dot — real ASCII art
// leaves true blank space for light areas, it doesn't shrink a character
// down to nothing.
//
// This is the first effect in the registry to declare `params` (see
// STYLIZE_EFFECTS below) — the first consumer of the general per-effect
// custom-parameter capability added to the registry alongside it, meant
// to be reused by future effects, not a one-off.
//
// Video: intentionally NOT stableAcrossFrames, so palette/random picks
// use frameSeed rather than clipSeed — frameSeed is time-derived (see
// VideoTab.jsx), so color naturally shifts as the video plays without
// any extra plumbing.
export function asciiShapes(buf, W, H, intensity, rng, params) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const mode = params?.colorMode ?? 'palette';
  const customColor = hexToRgb(params?.color);
  const full = new Uint8ClampedArray(buf.length);
  for (let i = 0; i < full.length; i += 4) { full[i] = 8; full[i + 1] = 8; full[i + 2] = 16; full[i + 3] = 255; }

  const cell = Math.max(4, Math.round(20 - 1 * 14));
  const maxR = cell * 0.62, minR = cell * 0.12;

  for (let by = 0; by < H; by += cell) {
    const bh = Math.min(cell, H - by);
    for (let bx = 0; bx < W; bx += cell) {
      const bw = Math.min(cell, W - bx);
      let l = 0, count = 0;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          l += luma(buf, ((by + y) * W + (bx + x)) * 4); count++;
        }
      }
      const lum = (l / count) / 255;
      if (lum > 0.92) continue; // near-white: leave blank, same as ASCII's empty space —
      // a luminance check, not a radius check: radius is floored at minR
      // regardless of how light the input is, so checking radius here
      // would only ever skip at very high intensity/small-cell settings
      const radius = minR + (1 - lum) * (maxR - minR);

      let color;
      if (mode === 'single') color = customColor;
      else if (mode === 'random') color = hsl2rgb(rng() * 360, 75, 55);
      else color = ASCII_PALETTE[Math.floor(rng() * ASCII_PALETTE.length)];

      const ccx = bx + bw / 2, ccy = by + bh / 2;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const px = bx + x, py = by + y;
          if (Math.hypot(px - ccx, py - ccy) <= radius) {
            const i = (py * W + px) * 4;
            full[i] = color[0]; full[i + 1] = color[1]; full[i + 2] = color[2]; full[i + 3] = 255;
          }
        }
      }
    }
  }
  if (intensity >= 1) return full;
  return lerpBuffer(buf, full, intensity);
}

export const STYLIZE_EFFECTS = [
  { id: 'halftoneFilter', label: 'HALFTONE', hint: 'newsprint dot pattern', category: 'print', mediaTypes: ['image', 'video'], fn: halftoneFilter },
  { id: 'edgeSketch', label: 'EDGE SKETCH', hint: 'sobel pencil outline', category: 'craft', mediaTypes: ['image', 'video'], fn: edgeSketch },
  { id: 'oilPaint', label: 'OIL PAINT', hint: 'mode-filter brushwork (full-quality frame capture only)', category: 'painterly', mediaTypes: ['image', 'video'], realtimeSafe: false, fn: oilPaint },
  { id: 'dotMosaic', label: 'DOT MOSAIC', hint: 'uniform circle-packed grid, full color', category: 'craft', mediaTypes: ['image', 'video'], fn: dotMosaic },
  {
    id: 'asciiShapes', label: 'ASCII SHAPES', hint: 'density mapped to shape, color is yours to pick', category: 'print', mediaTypes: ['image', 'video'], fn: asciiShapes,
    params: [
      { key: 'colorMode', type: 'select', label: 'COLOR', default: 'palette', options: [{ value: 'palette', label: 'Palette' }, { value: 'single', label: 'Single' }, { value: 'random', label: 'Random' }] },
      { key: 'color', type: 'color', label: 'PICK COLOR', default: '#00E5FF', showWhen: { colorMode: 'single' } },
    ],
  },
];
