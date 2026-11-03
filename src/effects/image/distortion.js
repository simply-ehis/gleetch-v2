import { clamp } from '../../core/color.js';
import { lerpBuffer } from '../../core/blend.js';

// Sliding-window box blur along one axis — O(W*H) regardless of radius.
// Three passes of box blur closely approximate a true Gaussian blur.
function boxBlur1D(src, W, H, radius, horizontal) {
  const out = new Uint8ClampedArray(src.length);
  const size = radius * 2 + 1;
  const outerLen = horizontal ? H : W;
  const innerLen = horizontal ? W : H;
  const getIdx = (outer, inner) => (horizontal ? outer * W + inner : inner * W + outer) * 4;

  for (let outer = 0; outer < outerLen; outer++) {
    let rSum = 0, gSum = 0, bSum = 0;
    for (let k = -radius; k <= radius; k++) {
      const i = getIdx(outer, clamp(k, 0, innerLen - 1));
      rSum += src[i]; gSum += src[i + 1]; bSum += src[i + 2];
    }
    for (let inner = 0; inner < innerLen; inner++) {
      const di = getIdx(outer, inner);
      out[di] = rSum / size; out[di + 1] = gSum / size; out[di + 2] = bSum / size; out[di + 3] = 255;
      const addI = getIdx(outer, clamp(inner + radius + 1, 0, innerLen - 1));
      const subI = getIdx(outer, clamp(inner - radius, 0, innerLen - 1));
      rSum += src[addI] - src[subI]; gSum += src[addI + 1] - src[subI + 1]; bSum += src[addI + 2] - src[subI + 2];
    }
  }
  return out;
}

export function gaussianBlur(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  if (intensity >= 1) {
    const radius = 12;
    let out = buf;
    for (let pass = 0; pass < 3; pass++) {
      out = boxBlur1D(out, W, H, radius, true);
      out = boxBlur1D(out, W, H, radius, false);
    }
    return out;
  }
  const radius = Math.max(1, Math.round(intensity * 12));
  let out = buf;
  for (let pass = 0; pass < 3; pass++) {
    out = boxBlur1D(out, W, H, radius, true);
    out = boxBlur1D(out, W, H, radius, false);
  }
  return lerpBuffer(buf, out, intensity);
}

// Mosaic: averages color within NxN blocks. Block size scales with intensity.
export function pixelate(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const outRaw = new Uint8ClampedArray(buf.length);
  const size = Math.max(1, Math.round(intensity * 40));
  for (let by = 0; by < H; by += size) {
    for (let bx = 0; bx < W; bx += size) {
      let r = 0, g = 0, b = 0, count = 0;
      const bh = Math.min(size, H - by), bw = Math.min(size, W - bx);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = ((by + y) * W + (bx + x)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; count++;
        }
      }
      r /= count; g /= count; b /= count;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = ((by + y) * W + (bx + x)) * 4;
          outRaw[i] = r; outRaw[i + 1] = g; outRaw[i + 2] = b; outRaw[i + 3] = 255;
        }
      }
    }
  }
  if (intensity >= 1) return outRaw;
  return lerpBuffer(buf, outRaw, intensity);
}

// Clean radial lens warp (barrel/pincushion) — a physical-looking bulge or pinch,
// distinct from WAVE WARP's glitchy per-pixel sine displacement.
export function lensWarp(buf, W, H, intensity, rng) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const out = new Uint8ClampedArray(buf.length);
  const cx = W / 2, cy = H / 2, maxR = Math.sqrt(cx * cx + cy * cy);
  const barrel = rng() < 0.5 ? 1 : -1;
  const strength = intensity * 0.6; // magnitude only; sign comes from the barrel pick
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy) / maxR;
      const factor = 1 + barrel * strength * r * r;
      const sx = clamp(Math.round(cx + dx * factor), 0, W - 1);
      const sy = clamp(Math.round(cy + dy * factor), 0, H - 1);
      const di = (y * W + x) * 4, si = (sy * W + sx) * 4;
      out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = 255;
    }
  }
  return out;
}

// LINE DISTORTION — each horizontal row shifts as a rigid unit by a smoothly
// flowing amount (summed sine harmonics), unlike SCANLINE RIP's random per-row
// jitter or WAVE WARP's per-pixel two-axis warp. Produces a "flowing curtain"
// / torn-CRT-lines look with continuous, not chaotic, motion.
export function lineDistortion(buf, W, H, intensity, rng) {
  const out = new Uint8ClampedArray(buf.length);
  const maxShift = intensity * W * 0.25;
  const harmonics = [
    { freq: 1 + rng() * 3, phase: rng() * Math.PI * 2, weight: 0.6 },
    { freq: 4 + rng() * 6, phase: rng() * Math.PI * 2, weight: 0.3 },
    { freq: 10 + rng() * 10, phase: rng() * Math.PI * 2, weight: 0.1 },
  ];
  for (let y = 0; y < H; y++) {
    let shift = 0;
    for (const h of harmonics) shift += Math.sin((y / H) * h.freq * Math.PI * 2 + h.phase) * h.weight;
    shift = Math.round(shift * maxShift);
    for (let x = 0; x < W; x++) {
      const di = (y * W + x) * 4;
      const si = (y * W + (((x - shift) % W) + W) % W) * 4;
      out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

// Uses the image's own luminance as a displacement field to warp itself — a
// self-referential liquify/melt effect.
export function displacementMap(buf, W, H, intensity) {
  const out = new Uint8ClampedArray(buf.length);
  const maxOffset = intensity * Math.min(W, H) * 0.06;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const luma = (buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11) / 255;
      const angle = luma * Math.PI * 2;
      const sx = clamp(Math.round(x + Math.cos(angle) * maxOffset * luma), 0, W - 1);
      const sy = clamp(Math.round(y + Math.sin(angle) * maxOffset * luma), 0, H - 1);
      const si = (sy * W + sx) * 4;
      out[i] = buf[si]; out[i + 1] = buf[si + 1]; out[i + 2] = buf[si + 2]; out[i + 3] = 255;
    }
  }
  return out;
}

export const DISTORTION_EFFECTS = [
  { id: 'gaussianBlur', label: 'GAUSSIAN BLUR', hint: 'soft directional-free blur', category: 'distortion', mediaTypes: ['image', 'video'], slot: 'blur', cost: 2, motion: { kind: 'pulse', target: 'radius', speed: 0.2 }, fn: gaussianBlur },
  { id: 'pixelate', label: 'PIXELATE', hint: 'mosaic block averaging', category: 'distortion', mediaTypes: ['image', 'video'], slot: 'texture', cost: 1, motion: { kind: 'steps', target: 'blockSize', speed: 0.3 }, fn: pixelate },
  { id: 'lensWarp', label: 'LENS WARP', hint: 'clean barrel/pincushion bulge', category: 'distortion', mediaTypes: ['image', 'video'], stableAcrossFrames: true, slot: 'warp', cost: 2, motion: { kind: 'breathe', target: 'bulge', speed: 0.15 }, fn: lensWarp },
  { id: 'lineDistortion', label: 'LINE DISTORTION', hint: 'flowing row-shift curtain', category: 'distortion', mediaTypes: ['image', 'video'], stableAcrossFrames: true, slot: 'warp', cost: 2, motion: { kind: 'pulse', target: 'frequency', speed: 0.3 }, fn: lineDistortion },
  { id: 'displacementMap', label: 'DISPLACEMENT MAP', hint: 'self-luminance liquify', category: 'distortion', mediaTypes: ['image', 'video'], slot: 'warp', cost: 3, motion: { kind: 'drift', target: 'scale', speed: 0.1 }, fn: displacementMap },
];
