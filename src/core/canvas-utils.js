// Worker-safe offscreen canvas: document exists on the main thread, but
// render.worker.js runs without a DOM — OffscreenCanvas covers both.
export function makeOffscreenCanvas(W, H) {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    return canvas;
  }
  return new OffscreenCanvas(W, H);
}

// Draws an image into a W×H canvas with cover/contain fit (cover fills and
// crops overflow, contain letterboxes on #0A0A1C). Shared by the live
// preview and the full-res export so both frame the upload identically.
export function drawFittedImage(ctx, img, W, H, fit = 'cover') {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  if (fit === 'contain') {
    ctx.fillStyle = '#0A0A1C';
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / iw, H / ih);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  } else {
    const s = Math.max(W / iw, H / ih);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  }
}

export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// Preserves the source image's own aspect ratio (scaled to fit within
// maxDim on the longer edge for processing speed) instead of force-cropping
// to a fixed square — this is what the canvas dimensions should actually be
// set to before drawing, not passed as a target size to crop into.
export function computeAdaptiveSize(img, maxDim = 1024) {
  const w = img.naturalWidth || img.videoWidth || 1;
  const h = img.naturalHeight || img.videoHeight || 1;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return { W: Math.max(1, Math.round(w * scale)), H: Math.max(1, Math.round(h * scale)) };
}

// Draws an image into a W×H canvas using cover-fit (fills frame, crops overflow)
export function drawImageCover(ctx, img, W, H) {
  ctx.clearRect(0, 0, W, H);
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
}
