import { codePoints } from '../../core/text-utils.js';

const ERODE_CHARS = ['░', '▒', '▓', ' '];

export function weathered(text, intensity, rng) {
  if (intensity <= 0) return text;
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    if (rng() < intensity * 0.3) return ERODE_CHARS[Math.floor(rng() * ERODE_CHARS.length)];
    return c;
  }).join('');
}

export function redact(text, intensity, rng) {
  if (intensity <= 0) return text;
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    return rng() < intensity * 0.5 ? '█' : c;
  }).join('');
}

export function fade(text, intensity, rng) {
  if (intensity <= 0) return text;
  const chars = codePoints(text);
  return chars.map((c, i) => {
    if (c === '\n' || c === ' ') return c;
    const threshold = (i / chars.length) * intensity;
    return rng() < threshold ? ' ' : c;
  }).join('');
}

export const DECAY_TEXT_EFFECTS = [
  { id: 'weathered', label: 'WEATHERED', hint: 'eroding stone inscription', category: 'decay', mediaTypes: ['text'], fn: weathered },
  { id: 'redact', label: 'REDACT', hint: 'blackout blocks', category: 'decay', mediaTypes: ['text'], fn: redact },
  { id: 'fade', label: 'FADE', hint: 'progressive dissolve', category: 'decay', mediaTypes: ['text'], fn: fade },
];
