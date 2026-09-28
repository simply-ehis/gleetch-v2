import { codePoints } from './text-utils.js';

// Renders text to a canvas as a poster. Used by W4b to make text a wallpaper.
export function renderTextPoster({ text, W, H, font = 'serif', size = 48, color = '#FFFFFF', bg = '#0A0A1C', align = 'center', vertical = 'middle' }) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = vertical;
  const lines = text.split('\n');
  const lineHeight = size * 1.2;
  const startY = vertical === 'middle' ? H / 2 - (lines.length - 1) * lineHeight / 2 : vertical === 'top' ? size : H - lines.length * lineHeight;
  lines.forEach((line, i) => {
    ctx.fillText(line, align === 'center' ? W / 2 : align === 'right' ? W : 0, startY + i * lineHeight);
  });
  return canvas;
}

export function detectMissingGlyphs(ctx, text, font, size) {
  ctx.font = `${size}px ${font}`;
  const tofuWidth = ctx.measureText('\u{10FFFD}').width;
  const chars = codePoints(text);
  const missing = [];
  for (const c of chars) {
    if (c === '\n' || c === ' ') continue;
    const w = ctx.measureText(c).width;
    if (Math.abs(w - tofuWidth) < 0.1) missing.push(c);
  }
  return missing;
}

export function renderTextToImageData({ text, W, H, font = 'serif', size = 48, color = '#FFFFFF', bg = '#0A0A1C' }) {
  const canvas = renderTextPoster({ text, W, H, font, size, color, bg });
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, W, H);
}
