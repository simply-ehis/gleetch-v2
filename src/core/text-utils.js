// Code-point-safe text helpers. All text effects must use these instead of
// split('') so astral-plane characters (U+10000+) aren't torn in half.

export function codePoints(str) {
  return Array.from(str);
}

export function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str), (s) => s.segment);
  }
  return Array.from(str);
}
