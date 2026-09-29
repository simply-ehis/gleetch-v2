import { clamp, lerp } from '../../core/color.js';
import { PATTERNS } from '../../patterns/registry.js';
import { makeOffscreenCanvas } from '../../core/canvas-utils.js';

const BLEND_FNS = {
  screen: (a, b) => 255 - ((255 - a) * (255 - b)) / 255,
  multiply: (a, b) => (a * b) / 255,
  overlay: (a, b) => (a < 128 ? (2 * a * b) / 255 : 255 - (2 * (255 - a) * (255 - b)) / 255),
};

// Renders a randomly-picked generative pattern into an offscreen canvas, then
// blends it onto the real image. intensity controls blend opacity (0-1).
function applyPatternOverlay(buf, W, H, intensity, rng, blendMode) {
  const pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)];
  const offscreen = makeOffscreenCanvas(W, H);
  const octx = offscreen.getContext('2d');
  pattern.fn(octx, W, H, rng);
  const patternBuf = octx.getImageData(0, 0, W, H).data;

  const out = new Uint8ClampedArray(buf.length);
  const blend = BLEND_FNS[blendMode];
  for (let i = 0; i < out.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const blended = blend(buf[i + c], patternBuf[i + c]);
      out[i + c] = clamp(lerp(buf[i + c], blended, intensity), 0, 255);
    }
    out[i + 3] = 255;
  }
  return out;
}

export function overlayScreen(buf, W, H, intensity, rng) {
  return applyPatternOverlay(buf, W, H, intensity, rng, 'screen');
}
export function overlayMultiply(buf, W, H, intensity, rng) {
  return applyPatternOverlay(buf, W, H, intensity, rng, 'multiply');
}
export function overlayBlend(buf, W, H, intensity, rng) {
  return applyPatternOverlay(buf, W, H, intensity, rng, 'overlay');
}

// Tagged realtimeSafe:false rather than staying image-only: some of the
// 120 patterns run 100k+ iterations per render (attractors, IFS fractals)
// — fine once for a still frame, too costly to re-render every frame of
// continuous video playback. applyVideoEffectChain (registry.js) skips
// realtimeSafe:false effects during live playback/continuous export; the
// full-quality single-frame capture path applies them unfiltered, since a
// one-off still frame has no real-time deadline to miss.
export const OVERLAY_EFFECTS = [
  { id: 'overlayScreen', label: 'OVERLAY: SCREEN', hint: 'lighten with a random pattern (full-quality frame capture only)', category: 'overlay', mediaTypes: ['image', 'video'], realtimeSafe: false, fn: overlayScreen },
  { id: 'overlayMultiply', label: 'OVERLAY: MULTIPLY', hint: 'darken with a random pattern (full-quality frame capture only)', category: 'overlay', mediaTypes: ['image', 'video'], realtimeSafe: false, fn: overlayMultiply },
  { id: 'overlayBlend', label: 'OVERLAY: BLEND', hint: 'contrast-blend a random pattern (full-quality frame capture only)', category: 'overlay', mediaTypes: ['image', 'video'], realtimeSafe: false, fn: overlayBlend },
];
