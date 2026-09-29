import { codePoints } from '../../core/text-utils.js';

export function boustrophedon(text, intensity, rng) {
  if (intensity <= 0) return text;
  return text.split('\n').map((line, i) => {
    if (i % 2 === 1 && rng() < intensity) return codePoints(line).reverse().join('');
    return line;
  }).join('\n');
}

export function concreteShape(text, intensity) {
  if (intensity <= 0) return text;
  const chars = codePoints(text).filter((c) => c !== '\n' && c !== ' ');
  if (!chars.length) return text;
  const lines = [];
  const width = Math.max(3, Math.floor(Math.sqrt(chars.length)));
  for (let i = 0; i < chars.length; i += width) {
    lines.push(chars.slice(i, i + width).join(''));
  }
  return lines.join('\n');
}

export function cipherShift(text, intensity) {
  if (intensity <= 0) return text;
  const shift = Math.max(1, Math.floor(intensity * 13));
  return codePoints(text).map((c) => {
    const code = c.codePointAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(((code - 65 + shift) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(((code - 97 + shift) % 26) + 97);
    return c;
  }).join('');
}

export function ornamentBorder(text, intensity, rng) {
  if (intensity <= 0) return text;
  const ornaments = ['❦', '⁂', '❧', '☙', '❧'];
  const orn = ornaments[Math.floor(rng() * ornaments.length)];
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => l.length), 10);
  const border = orn.repeat(Math.ceil(width / 2));
  return `${border}\n${text}\n${border}`;
}

export const STRUCTURE_TEXT_EFFECTS = [
  { id: 'boustrophedon', label: 'BOUSTROPHEDON', hint: 'alternate lines reversed', category: 'structure', mediaTypes: ['text'], fn: boustrophedon },
  { id: 'concreteShape', label: 'CONCRETE SHAPE', hint: 'text set into geometric shape', category: 'structure', mediaTypes: ['text'], fn: concreteShape },
  { id: 'cipherShift', label: 'CIPHER SHIFT', hint: 'Caesar/Atbash shift', category: 'structure', mediaTypes: ['text'], fn: cipherShift },
  { id: 'ornamentBorder', label: 'ORNAMENT BORDER', hint: 'decorative frame dividers', category: 'structure', mediaTypes: ['text'], fn: ornamentBorder },
];
