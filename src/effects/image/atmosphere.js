import { clamp } from '../../core/color.js';

// A useful base-image treatment rather than another corruption pass: it pulls
// contour lines from the source luminance and softly lights the ridges. The
// result works especially well on Gleetch's procedural fields and remains
// stable across a video clip because it has no random style decision.
export function topographicContours(buf, W, H, intensity) {
  if (intensity <= 0) return new Uint8ClampedArray(buf);
  const out = new Uint8ClampedArray(buf);
  const bands = 5 + Math.round(intensity * 15);
  const lineWidth = 0.045 + (1 - intensity) * 0.06;
  for (let i = 0; i < out.length; i += 4) {
    const luma = (buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114) / 255;
    const phase = (luma * bands) % 1;
    const edge = Math.min(phase, 1 - phase);
    const line = clamp(1 - edge / lineWidth, 0, 1) * intensity;
    const glow = Math.pow(luma, 1.8) * intensity * 0.14;
    out[i] = clamp(buf[i] * (1 - line * 0.58) + 218 * glow, 0, 255);
    out[i + 1] = clamp(buf[i + 1] * (1 - line * 0.52) + 241 * glow, 0, 255);
    out[i + 2] = clamp(buf[i + 2] * (1 - line * 0.38) + 255 * glow, 0, 255);
  }
  return out;
}

export const ATMOSPHERE_EFFECTS = [
  { id: 'topographicContours', label: 'TOPOGRAPHIC CONTOURS', hint: 'luminance terrain lines with a quiet ridge glow', category: 'stylize', mediaTypes: ['image', 'video'], stableAcrossFrames: true, fn: topographicContours },
];
