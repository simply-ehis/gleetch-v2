import { codePoints } from '../../core/text-utils.js';
import { HOMOGLYPHS } from './corruption.js';

// MARGIN DRIFT — the text equivalent of LENS ABERRATION: clean, quiet in the
// middle of each line, and increasingly fringed toward the line edges. Same
// "distance from center, squared" falloff as the image effect, just mapped
// onto character position within a line instead of pixel distance from the
// canvas center.
export function marginDrift(text, intensity, rng) {
  return text.split('\n').map((line) => {
    const chars = codePoints(line);
    const L = chars.length;
    if (L < 3) return line;
    const center = (L - 1) / 2;
    return chars.map((c, i) => {
      const distFromCenter = Math.abs(i - center) / center; // 0 at middle, 1 at edges
      const chance = intensity * distFromCenter * distFromCenter;
      return rng() < chance && HOMOGLYPHS[c] ? HOMOGLYPHS[c] : c;
    }).join('');
  }).join('\n');
}

// CASE WAVE — a smooth sinusoidal upper/lower alternation by character
// position, instead of CASE CHAOS's per-character coin flip. Reads as a
// deliberate rippling pattern rather than noise.
export function caseWave(text, intensity, rng) {
  if (intensity <= 0) return text;
  const freq = 0.15 + intensity * 0.5;
  const phase = rng() * Math.PI * 2;
  let i = 0;
  return codePoints(text).map((c) => {
    if (!/[a-zA-Z]/.test(c)) return c;
    const wave = Math.sin(i++ * freq + phase);
    return wave > 0 ? c.toUpperCase() : c.toLowerCase();
  }).join('');
}

// WHITESPACE BREATHE — the gap between words swells and shrinks along a
// smooth sine wave across the text, instead of random noise injection.
export function whitespaceBreathe(text, intensity, rng) {
  const freq = 0.3 + intensity * 0.6;
  const phase = rng() * Math.PI * 2;
  let wordIndex = 0;
  return text.replace(/ +/g, () => {
    const wave = (Math.sin(wordIndex++ * freq + phase) + 1) / 2; // 0..1
    const extra = Math.round(wave * intensity * 4);
    return ' '.repeat(1 + extra);
  });
}

export const CLEAN_TONE_TEXT_EFFECTS = [
  { id: 'marginDrift', label: 'MARGIN DRIFT', hint: 'clean center, fringed edges', category: 'clean-tone', mediaTypes: ['text'], fn: marginDrift },
  { id: 'caseWave', label: 'CASE WAVE', hint: 'smooth rippling capitalisation', category: 'clean-tone', mediaTypes: ['text'], fn: caseWave },
  { id: 'whitespaceBreathe', label: 'WHITESPACE BREATHE', hint: 'word gaps swell and shrink', category: 'clean-tone', mediaTypes: ['text'], fn: whitespaceBreathe },
];
