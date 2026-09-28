import { codePoints } from '../../core/text-utils.js';

const COMBINING = ['\u0300', '\u0301', '\u0302', '\u0308', '\u0324', '\u0325', '\u0330', '\u0332', '\u0336', '\u0337', '\u0338', '\u033f', '\u0360', '\u031a', '\u0328'];
export const HOMOGLYPHS = { a: 'а', e: 'е', o: 'о', c: 'с', p: 'р', x: 'х', y: 'у', i: 'і', A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };
const NOISE_CHARS = '!@#$%^&*~`|\\/<>{}[]?0O1l';

export function zalgo(text, intensity, rng) {
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    let r = c;
    const n = Math.floor(rng() * intensity * 10);
    for (let i = 0; i < n; i++) r += COMBINING[Math.floor(rng() * COMBINING.length)];
    return r;
  }).join('');
}

export function homoglyph(text, intensity, rng) {
  return codePoints(text).map((c) => (rng() < intensity * 0.7 && HOMOGLYPHS[c] ? HOMOGLYPHS[c] : c)).join('');
}

export function stutter(text, intensity, rng) {
  return text.replace(/\b\w/g, (m) => (rng() < intensity * 0.5 ? `${m}-${m}-${m}` : m));
}

export function scramble(text, intensity, rng) {
  return text.replace(/\b[a-zA-Z]{4,}\b/g, (w) => {
    if (rng() > intensity * 0.7) return w;
    const mid = w.slice(1, -1).split('');
    for (let i = mid.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [mid[i], mid[j]] = [mid[j], mid[i]];
    }
    return w[0] + mid.join('') + w[w.length - 1];
  });
}

export function lineChaos(text, intensity, rng) {
  const lines = text.split('\n');
  const n = Math.floor(intensity * lines.length * 0.5);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rng() * lines.length), b = Math.floor(rng() * lines.length);
    [lines[a], lines[b]] = [lines[b], lines[a]];
  }
  return lines.join('\n');
}

export function charCorrupt(text, intensity, rng) {
  return codePoints(text).map((c) => {
    if (rng() < intensity * 0.15) return String.fromCodePoint(c.codePointAt(0) ^ (1 << Math.floor(rng() * 6)));
    return c;
  }).join('');
}

export function repeatBlocks(text, intensity, rng) {
  const lines = text.split('\n');
  const n = Math.floor(intensity * 5);
  const result = [...lines];
  for (let i = 0; i < n; i++) {
    const src = Math.floor(rng() * lines.length), dst = Math.floor(rng() * result.length);
    result.splice(dst, 0, lines[src]);
  }
  return result.join('\n');
}

export function caseChaos(text, intensity, rng) {
  return codePoints(text).map((c) => (rng() < intensity * 0.4 ? (rng() < 0.5 ? c.toUpperCase() : c.toLowerCase()) : c)).join('');
}

export function noiseInject(text, intensity, rng) {
  return codePoints(text).map((c) => {
    if (c === '\n') return c;
    if (rng() < intensity * 0.12) return c + NOISE_CHARS[Math.floor(rng() * NOISE_CHARS.length)];
    return c;
  }).join('');
}

export function segReverse(text, intensity, rng) {
  const words = text.split(' ');
  const n = Math.floor(intensity * words.length * 0.3);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rng() * words.length);
    const b = Math.min(a + 2 + Math.floor(rng() * 5), words.length);
    words.splice(a, b - a, ...words.slice(a, b).reverse());
  }
  return words.join(' ');
}

export const TEXT_EFFECTS = [
  { id: 'zalgo', label: 'ZALGO', hint: 'combining unicode overflow', category: 'corruption', mediaTypes: ['text'], fn: zalgo },
  { id: 'homoglyph', label: 'HOMOGLYPH', hint: 'lookalike char substitution', category: 'corruption', mediaTypes: ['text'], fn: homoglyph },
  { id: 'stutter', label: 'STUTTER', hint: 'r-r-repeat character bursts', category: 'corruption', mediaTypes: ['text'], fn: stutter },
  { id: 'scramble', label: 'SCRAMBLE', hint: 'shuffle word internals', category: 'corruption', mediaTypes: ['text'], fn: scramble },
  { id: 'lineChaos', label: 'LINE CHAOS', hint: 'random line reorder', category: 'corruption', mediaTypes: ['text'], fn: lineChaos },
  { id: 'charCorrupt', label: 'CHAR CORRUPT', hint: 'bit-flip individual chars', category: 'corruption', mediaTypes: ['text'], fn: charCorrupt },
  { id: 'repeatBlocks', label: 'BLOCK REPEAT', hint: 'datamosh for text', category: 'corruption', mediaTypes: ['text'], fn: repeatBlocks },
  { id: 'caseChaos', label: 'CASE CHAOS', hint: 'rAnDoM cApItAlIsAtIoN', category: 'corruption', mediaTypes: ['text'], fn: caseChaos },
  { id: 'noiseInject', label: 'NOISE INJECT', hint: 'inject symbol static', category: 'corruption', mediaTypes: ['text'], fn: noiseInject },
  { id: 'segReverse', label: 'SEG REVERSE', hint: 'reverse word segments', category: 'corruption', mediaTypes: ['text'], fn: segReverse },
];
