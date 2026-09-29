import { codePoints } from '../../core/text-utils.js';

const DRIP_MARKS = ['\u0330', '\u0332', '\u0333', '\u0331', '\u0327', '\u0328'];
const RISE_MARKS = ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0351'];
const INK_MARKS = ['\u0323', '\u0324', '\u0325', '\u0326', '\u0328', '\u0329'];

export function meltDown(text, intensity, rng) {
  if (intensity <= 0) return text;
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    const n = Math.floor(rng() * intensity * 4);
    let out = c;
    for (let i = 0; i < n; i++) out += DRIP_MARKS[Math.floor(rng() * DRIP_MARKS.length)];
    return out;
  }).join('');
}

export function riseUp(text, intensity, rng) {
  if (intensity <= 0) return text;
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    const n = Math.floor(rng() * intensity * 4);
    let out = c;
    for (let i = 0; i < n; i++) out += RISE_MARKS[Math.floor(rng() * RISE_MARKS.length)];
    return out;
  }).join('');
}

export function inkBleed(text, intensity, rng) {
  if (intensity <= 0) return text;
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    const n = Math.floor(rng() * intensity * 3);
    let out = c;
    for (let i = 0; i < n; i++) out += INK_MARKS[Math.floor(rng() * INK_MARKS.length)];
    return out;
  }).join('');
}

export function frameCrawl(text, intensity) {
  if (intensity <= 0) return text;
  const chars = codePoints(text).filter((c) => c !== '\n' && c !== ' ');
  if (!chars.length) return text;
  const border = chars.slice(0, Math.max(1, Math.floor(chars.length * 0.3 * intensity)));
  const borderStr = border.join('');
  const reversed = codePoints(borderStr).reverse().join('');
  return `${borderStr}\n${text}\n${reversed}`;
}

export const OVERFLOW2_TEXT_EFFECTS = [
  { id: 'meltDown', label: 'MELT DOWN', hint: 'marks drip downward', category: 'overflow', mediaTypes: ['text'], fn: meltDown },
  { id: 'riseUp', label: 'RISE UP', hint: 'marks float upward', category: 'overflow', mediaTypes: ['text'], fn: riseUp },
  { id: 'inkBleed', label: 'INK BLEED', hint: 'descenders bleed below', category: 'overflow', mediaTypes: ['text'], fn: inkBleed },
  { id: 'frameCrawl', label: 'FRAME CRAWL', hint: 'text flows along frame border', category: 'overflow', mediaTypes: ['text'], fn: frameCrawl },
];
