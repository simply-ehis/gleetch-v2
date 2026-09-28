// Unicode "Mathematical Alphanumeric Symbols" font variants (U+1D400–1D7FF)
// — these are real, distinct Unicode code points, not a CSS/font trick, so
// they round-trip through copy-paste and plain-text export anywhere.
// Character tables verified against the Unicode Consortium's published
// block layout, including every legacy-letterlike-symbol exception: a
// handful of Script/Fraktur/Double-struck letters live in the older
// Letterlike Symbols block instead of the Math Alphanumeric block (e.g.
// double-struck R is ℝ U+211D, not the "expected" U+1D53D — that code
// point is reserved/unassigned). Getting even one of these wrong renders
// as a missing-glyph box, so every string below is a direct transcription
// of the official table rather than a computed offset.
// Mathematical Alphanumeric Symbols live above U+FFFF (the Supplementary
// Multilingual Plane) — each character is a surrogate PAIR, two UTF-16 code
// units. Raw string indexing (str[5]) would slice a pair in half and
// produce a broken glyph, so every style is pre-split into an array of
// actual codepoints with Array.from() before any lookup happens.
const styledFont = (upper, lower, digits) => ({
  upper: Array.from(upper), lower: Array.from(lower), digits: digits ? Array.from(digits) : null,
});

const FONT_STYLES = [
  styledFont('𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙', '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳', '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'),
  styledFont('𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍', '𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧', null),
  styledFont('𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹', '𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓', '𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫'),
  styledFont('𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉', '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'),
  styledFont('𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ', '𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫', '𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡'),
  styledFont('𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ', '𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷', null),
  styledFont('𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩', '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃', null),
  styledFont('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ', 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ', '０１２３４５６７８９'),
];

function styleChar(c, style) {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return style.upper[code - 65];
  if (code >= 97 && code <= 122) return style.lower[code - 97];
  if (code >= 48 && code <= 57) return style.digits ? style.digits[code - 48] : c;
  return c;
}

import { codePoints } from '../../core/text-utils.js';

// FONT SHUFFLE — assigns a randomly-picked Unicode typeface to each word.
// Words stay internally consistent (so individual words stay legible) while
// the passage as a whole reads as a chaotic mix of typefaces. intensity
// controls what fraction of words get restyled; untouched words stay plain.
export function fontShuffle(text, intensity, rng) {
  return text.split(/(\s+)/).map((token) => {
    if (!token || /^\s+$/.test(token)) return token;
    if (rng() >= intensity) return token;
    const style = FONT_STYLES[Math.floor(rng() * FONT_STYLES.length)];
    return codePoints(token).map((c) => styleChar(c, style)).join('');
  }).join('');
}

export const TYPOGRAPHY_TEXT_EFFECTS = [
  { id: 'fontShuffle', label: 'FONT SHUFFLE', hint: 'random unicode typeface per word', category: 'typography', mediaTypes: ['text'], fn: fontShuffle },
];
