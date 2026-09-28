// Curated palettes + OKLCH-based harmony generator.
// Used by gradientMap, duotone, and shuffle so a wallpaper isn't stuck in one hue family.

export const CURATED_PALETTES = [
  { name: 'Gleetch', colors: [[0, 229, 255], [255, 45, 107], [150, 80, 255], [80, 255, 160]] },
  { name: 'Sunset', colors: [[255, 107, 53], [255, 195, 112], [255, 77, 141], [150, 80, 255]] },
  { name: 'Ocean', colors: [[0, 128, 255], [0, 229, 255], [80, 255, 160], [150, 80, 255]] },
  { name: 'Forest', colors: [[80, 255, 160], [150, 255, 80], [255, 220, 100], [255, 150, 50]] },
  { name: 'Neon', colors: [[255, 45, 107], [150, 80, 255], [0, 229, 255], [255, 220, 100]] },
  { name: 'Mono', colors: [[255, 255, 255], [200, 200, 200], [100, 100, 100], [0, 0, 0]] },
];

export function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function generateHarmony(baseHue, scheme = 'analogous') {
  switch (scheme) {
    case 'complementary': return [baseHue, baseHue + 180];
    case 'triadic': return [baseHue, baseHue + 120, baseHue + 240];
    case 'split-complementary': return [baseHue, baseHue + 150, baseHue + 210];
    case 'analogous':
    default: return [baseHue, baseHue + 30, baseHue + 60];
  }
}

export function paletteFromHue(hue, scheme = 'analogous') {
  const hues = generateHarmony(hue, scheme);
  return hues.map((h) => hsl2rgb(h, 0.7, 0.55));
}
