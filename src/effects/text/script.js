import { codePoints } from '../../core/text-utils.js';

const RUNIC = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const OGHAM = ' ᚁᚂᚃᚄᚅᚆᚇᚈᚉᚊᚋᚌᚍᚎᚏᚐᚑᚒᚓᚔᚕᚖᚗᚘᚙᚚ';
const HIEROGLYPHS = '𓀀𓀁𓀂𓀃𓀄𓀅𓀆𓀇𓀈𓀉𓀊𓀋𓀌𓀍𓀎𓀏𓀐𓀑𓀒𓀓𓀔𓀕𓀖𓀗𓀘𓀙𓀚𓀛𓀜𓀝𓀞𓀟';
const CUNEIFORM = '𒀀𒀁𒀂𒀃𒀄𒀅𒀆𒀇𒀈𒀉𒀊𒀋𒀌𒀍𒀎𒀏𒀐𒀑𒀒𒀓𒀔𒀕𒀖𒀗𒀘𒀙𒀚𒀛𒀜𒀝𒀞𒀟';
const LINEAR_B = '𐀀𐀁𐀂𐀃𐀄𐀅𐀆𐀇𐀈𐀉𐀊𐀋𐀌𐀍𐀎𐀏𐀐𐀑𐀒𐀓𐀔𐀕𐀖𐀗𐀘𐀙𐀚𐀛𐀜𐀝𐀞𐀟';
const PHOENICIAN = '𐤀𐤁𐤂𐤃𐤄𐤅𐤆𐤇𐤈𐤉𐤊𐤋𐤌𐤍𐤎𐤏𐤐𐤑𐤒𐤓𐤔𐤕𐤖𐤗𐤘𐤙𐤚𐤛𐤜𐤝𐤞𐤟';
const MAYAN_NUMERALS = '𝋠𝋡𝋢𝋣𝋤𝋥𝋦𝋧𝋨𝋩𝋪𝋫𝋬𝋭𝋮𝋯𝋰𝋱𝋲𝋳';

const SCRIPT_BLOCKS = { RUNIC, OGHAM, HIEROGLYPHS, CUNEIFORM, LINEAR_B, PHOENICIAN, MAYAN_NUMERALS };

function cipherMap(text, block, rng) {
  const map = new Map();
  let idx = 0;
  return codePoints(text).map((c) => {
    if (!map.has(c)) map.set(c, codePoints(block)[idx++ % codePoints(block).length]);
    return map.get(c);
  }).join('');
}

function shapeMap(text, block, rng) {
  const chars = codePoints(block);
  return codePoints(text).map((c) => {
    const code = c.codePointAt(0);
    return chars[code % chars.length];
  }).join('');
}

function scatterMap(text, block, rng) {
  const chars = codePoints(block);
  return codePoints(text).map((c) => {
    if (c === '\n' || c === ' ') return c;
    return chars[Math.floor(rng() * chars.length)];
  }).join('');
}

export function runify(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, RUNIC, rng);
}

export function oghamize(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, OGHAM, rng);
}

export function hieroglyph(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, HIEROGLYPHS, rng);
}

export function cuneiform(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, CUNEIFORM, rng);
}

export function linearB(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, LINEAR_B, rng);
}

export function phoenician(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, PHOENICIAN, rng);
}

export function mayanNumerals(text, intensity, rng, params) {
  if (intensity <= 0) return text;
  const mode = params?.mode ?? 'cipher';
  const mapFn = mode === 'shape' ? shapeMap : mode === 'scatter' ? scatterMap : cipherMap;
  return mapFn(text, MAYAN_NUMERALS, rng);
}

const MODE_OPTIONS = [{ value: 'cipher', label: 'Cipher' }, { value: 'shape', label: 'Shape' }, { value: 'scatter', label: 'Scatter' }];

export const SCRIPT_TEXT_EFFECTS = [
  { id: 'runify', label: 'RUNIFY', hint: 'Elder Futhark runes', category: 'script', mediaTypes: ['text'], fn: runify, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
  { id: 'oghamize', label: 'OGHAMIZE', hint: 'Ogham script', category: 'script', mediaTypes: ['text'], fn: oghamize, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
  { id: 'hieroglyph', label: 'HIEROGLYPH', hint: 'Egyptian hieroglyphs', category: 'script', mediaTypes: ['text'], fn: hieroglyph, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
  { id: 'cuneiform', label: 'CUNEIFORM', hint: 'Sumerian cuneiform', category: 'script', mediaTypes: ['text'], fn: cuneiform, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
  { id: 'linearB', label: 'LINEAR B', hint: 'Linear B syllabary', category: 'script', mediaTypes: ['text'], fn: linearB, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
  { id: 'phoenician', label: 'PHOENICIAN', hint: 'Phoenician alphabet', category: 'script', mediaTypes: ['text'], fn: phoenician, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
  { id: 'mayanNumerals', label: 'MAYAN NUMERALS', hint: 'Mayan numeral system', category: 'script', mediaTypes: ['text'], fn: mayanNumerals, params: [{ key: 'mode', type: 'select', label: 'MODE', default: 'cipher', options: MODE_OPTIONS }] },
];
