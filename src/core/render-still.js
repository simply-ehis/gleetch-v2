import { prng } from './rng.js';
import { applyEffectChain } from '../effects/registry.js';
import { renderProcedural } from './procedural.js';

// Pure function: same seed + same recipe = same output at any resolution.
// Preview = small (tier-based). Export = target size, re-rendered from scratch.
export function renderStill({ seed, algos, intensity, channel, effectParams, W, H, maxLayers = 3, dither = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try { renderProcedural(ctx, W, H, seed, { maxLayers }); }
  catch { ctx.fillStyle = '#FF2D6B'; ctx.fillRect(0, 0, W, H); }
  let buf = ctx.getImageData(0, 0, W, H).data;
  buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity, channel }, prng(seed + 999), effectParams);
  if (dither) applyDither(buf, W, H);
  return buf;
}

// Ordered (Bayer) dither to prevent banding in smooth dark gradients.
function applyDither(buf, W, H) {
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const threshold = 16;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = (BAYER[y % 4][x % 4] - 7.5) / 64;
      buf[i] = Math.max(0, Math.min(255, buf[i] + t * threshold));
      buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + t * threshold));
      buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + t * threshold));
    }
  }
}

export const EXPORT_PRESETS = [
  { id: 'phone', label: 'PHONE', ratio: 9 / 16, longEdge: 2796 },
  { id: '1080p', label: '1080p', ratio: 9 / 16, longEdge: 2160 },
  { id: '1440p', label: '1440p', ratio: 9 / 16, longEdge: 3200 },
  { id: '4k', label: '4K', ratio: 9 / 16, longEdge: 4096 },
  { id: 'square', label: 'SQUARE', ratio: 1, longEdge: 2048 },
  { id: 'wide', label: 'WIDE', ratio: 16 / 9, longEdge: 3840 },
];

export function resolveExportDims(presetId, customW, customH) {
  if (presetId === 'custom') {
    const W = Math.max(64, Math.min(4096, Math.round(customW) || 1024));
    const H = Math.max(64, Math.min(4096, Math.round(customH) || 1024));
    return { W, H };
  }
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return { W: 1024, H: 1024 };
  const longEdge = preset.longEdge;
  if (preset.ratio >= 1) return { W: longEdge, H: Math.round(longEdge / preset.ratio) };
  return { W: Math.round(longEdge * preset.ratio), H: longEdge };
}
