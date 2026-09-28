// Text that deliberately escapes its normal line box. These effects remain
// plain Unicode/text so they export and copy without a renderer dependency.
const HIGH = ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0351', '\u0357', '\u035b', '\u0363'];
const LOW = ['\u0316', '\u0317', '\u0318', '\u0319', '\u031c', '\u0323', '\u0324', '\u0331'];
const STRIKE = ['\u0335', '\u0336', '\u0337', '\u0338'];
const GLYPHS = ['░', '▒', '▓', '█', '▚', '▞', '◆', '◈', '⊹'];

function words(text) { return text.split(/(\s+)/); }
function isWord(token) { return token && !/^\s+$/.test(token); }
function markWord(word, marks, count, rng) {
  return Array.from(word).map((char) => {
    let out = char;
    for (let i = 0; i < count; i++) out += marks[Math.floor(rng() * marks.length)];
    return out;
  }).join('');
}

export function skywrite(text, intensity, rng) {
  if (intensity <= 0) return text;
  const count = 1 + Math.floor(intensity * 6);
  return Array.from(text).map((char) => /\s/.test(char) || rng() > intensity ? char : markWord(char, HIGH, count, rng)).join('');
}

export function undercurrent(text, intensity, rng) {
  if (intensity <= 0) return text;
  const count = 1 + Math.floor(intensity * 5);
  return Array.from(text).map((char) => /\s/.test(char) || rng() > intensity ? char : markWord(char, LOW, count, rng)).join('');
}

export function overprint(text, intensity, rng) {
  if (intensity <= 0) return text;
  const count = 1 + Math.floor(intensity * 3);
  return Array.from(text).map((char) => /\s/.test(char) || rng() > intensity * 0.8 ? char : markWord(char, STRIKE, count, rng)).join('');
}

export function wordCascade(text, intensity, rng) {
  if (intensity <= 0) return text;
  let step = 0;
  return words(text).map((token) => {
    if (!isWord(token) || rng() > intensity) return token;
    step += 1;
    return `${token}\n${' '.repeat(Math.min(24, step * (1 + Math.floor(intensity * 4))))}`;
  }).join('');
}

export function echoMargin(text, intensity, rng) {
  if (intensity <= 0) return text;
  return text.split('\n').map((line) => {
    if (!line || rng() > intensity) return line;
    const tail = Array.from(line).filter((c) => !/\s/.test(c)).slice(-Math.max(1, Math.ceil(intensity * 6))).join('');
    return `${line}\n${' '.repeat(2 + Math.floor(rng() * 12))}↳ ${tail}`;
  }).join('\n');
}

export function monospike(text, intensity, rng) {
  if (intensity <= 0) return text;
  return words(text).map((token) => {
    if (!isWord(token) || rng() > intensity) return token;
    const gap = ' '.repeat(1 + Math.floor(intensity * 5));
    return Array.from(token).join(gap);
  }).join('');
}

export function railFence(text, intensity, rng) {
  if (intensity <= 0) return text;
  const width = Math.max(8, Math.round(12 + intensity * 26));
  const rule = Array.from({ length: width }, () => rng() < 0.35 ? '┄' : '─').join('');
  return text.split('\n').map((line) => rng() < intensity ? `┌${rule}\n│ ${line}\n└${rule}` : line).join('\n');
}

export function glyphBloom(text, intensity, rng) {
  if (intensity <= 0) return text;
  return Array.from(text).map((char) => {
    if (/\s/.test(char) || rng() > intensity * 0.55) return char;
    const left = GLYPHS[Math.floor(rng() * GLYPHS.length)];
    const right = GLYPHS[Math.floor(rng() * GLYPHS.length)];
    return `${left}${char}${right}`;
  }).join('');
}

export function blackoutPoetry(text, intensity, rng) {
  if (intensity <= 0) return text;
  return words(text).map((token) => {
    if (!isWord(token) || rng() > intensity) return token;
    return rng() < 0.5 ? '█'.repeat(Math.max(1, Array.from(token).length)) : token;
  }).join('');
}

export function bracketOrbit(text, intensity, rng) {
  if (intensity <= 0) return text;
  const pairs = [['[', ']'], ['{', '}'], ['⟨', '⟩'], ['⟦', '⟧'], ['⟪', '⟫']];
  return words(text).map((token) => {
    if (!isWord(token) || rng() > intensity) return token;
    const pair = pairs[Math.floor(rng() * pairs.length)];
    return `${pair[0]}${token}${pair[1]}`;
  }).join('');
}

export function driftColumns(text, intensity, rng) {
  if (intensity <= 0) return text;
  return text.split('\n').map((line, index) => {
    const offset = Math.round(Math.sin(index * 1.7 + rng() * 4) * intensity * 18);
    return offset >= 0 ? `${' '.repeat(offset)}${line}` : `${line}${' '.repeat(-offset)}`;
  }).join('\n');
}

export function refrain(text, intensity, rng) {
  if (intensity <= 0) return text;
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    out.push(line);
    if (line && rng() < intensity * 0.7) out.push(`${' '.repeat(1 + Math.floor(rng() * 8))}… ${line}`);
  }
  return out.join('\n');
}

export const OVERFLOW_TEXT_EFFECTS = [
  { id: 'skywrite', label: 'SKYWRITE', hint: 'upper combining marks spill above the line', category: 'overflow', mediaTypes: ['text'], fn: skywrite },
  { id: 'undercurrent', label: 'UNDERCURRENT', hint: 'descenders leak beneath the baseline', category: 'overflow', mediaTypes: ['text'], fn: undercurrent },
  { id: 'overprint', label: 'OVERPRINT', hint: 'stacked strike marks, photocopied too often', category: 'overflow', mediaTypes: ['text'], fn: overprint },
  { id: 'wordCascade', label: 'WORD CASCADE', hint: 'words tumble into a stepped vertical fall', category: 'overflow', mediaTypes: ['text'], fn: wordCascade },
  { id: 'echoMargin', label: 'ECHO MARGIN', hint: 'line tails reappear in the gutter', category: 'overflow', mediaTypes: ['text'], fn: echoMargin },
  { id: 'monospike', label: 'MONOSPIKE', hint: 'letters stretch into a wide signal', category: 'overflow', mediaTypes: ['text'], fn: monospike },
  { id: 'railFence', label: 'RAIL FENCE', hint: 'boxed type spills into terminal architecture', category: 'overflow', mediaTypes: ['text'], fn: railFence },
  { id: 'glyphBloom', label: 'GLYPH BLOOM', hint: 'characters sprout geometric satellites', category: 'overflow', mediaTypes: ['text'], fn: glyphBloom },
  { id: 'blackoutPoetry', label: 'BLACKOUT POETRY', hint: 'selective redaction leaves a found poem', category: 'overflow', mediaTypes: ['text'], fn: blackoutPoetry },
  { id: 'bracketOrbit', label: 'BRACKET ORBIT', hint: 'words collect mismatched containers', category: 'overflow', mediaTypes: ['text'], fn: bracketOrbit },
  { id: 'driftColumns', label: 'DRIFT COLUMNS', hint: 'lines migrate through a loose column', category: 'overflow', mediaTypes: ['text'], fn: driftColumns },
  { id: 'refrain', label: 'REFRAIN', hint: 'echoed lines turn prose into a chant', category: 'overflow', mediaTypes: ['text'], fn: refrain },
];
