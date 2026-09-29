import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { prng } from '../core/rng.js';
import { loadImageFile, drawImageCover, drawFittedImage } from '../core/canvas-utils.js';
import { FORMATS, resolveDims, clampDim } from '../core/formats.js';
import { renderProcedural } from '../core/procedural.js';
import { getEffectsFor, applyEffectChain, randomEffectSelection, isNoOp } from '../effects/registry.js';
import { IMAGE_PRESETS, V_CHANNELS } from '../effects/presets.js';
import { randomSeed } from '../core/constants.js';
import AlgoPanel from './AlgoPanel.jsx';
import PresetPanel from './PresetPanel.jsx';
import UploadZone from './UploadZone.jsx';
import ShuffleButton from './ShuffleButton.jsx';
import ScrambleText from './ScrambleText.jsx';
import ActiveChainList from './ActiveChainList.jsx';
import CopyRecipeButton from './CopyRecipeButton.jsx';
import { useQuality } from '../core/quality.jsx';
import { renderStill, EXPORT_SCALES, resolveExportDims } from '../core/render-still.js';

const IMAGE_EFFECTS = getEffectsFor('image');

function loadFormatPref() {
  try {
    const raw = localStorage.getItem('gleetch-format');
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.id) return null;
    return o;
  } catch { return null; }
}

export default function VisualTab({ seed, iter, onReroll, mode, setMode, uploadedImg, setUploadedImg, initialRecipe, seedLocked, onSeedLockChange }) {
  const { current: quality } = useQuality();

  const [algos, setAlgos] = useState(() => {
    if (initialRecipe?.a?.length) return initialRecipe.a;
    return randomEffectSelection('image', prng(randomSeed()));
  });
  const [intensity, setIntensity] = useState(initialRecipe?.i ?? 0.55);
  const [channel, setChannel] = useState(initialRecipe?.c ?? 'brightness');
  const [effectParams, setEffectParams] = useState(initialRecipe?.p ?? {});
  const [preset, setPreset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gleetch-favorites') || '[]'); } catch { return []; }
  });
  const [exportScale, setExportScale] = useState('x4');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef(null);
  const workRef = useRef(null);
  const outRef = useRef(null);
  const outImageDataRef = useRef(null);

  // Format state: id + custom W/H + fit
  const [fmt, setFmt] = useState(() => {
    if (initialRecipe?.f?.id) {
      return {
        id: initialRecipe.f.id,
        w: clampDim(initialRecipe.f.w ?? 512),
        h: clampDim(initialRecipe.f.h ?? 512),
        fit: initialRecipe.f.fit === 'contain' ? 'contain' : 'cover',
      };
    }
    const pref = loadFormatPref();
    if (pref?.id) return { id: pref.id, w: clampDim(pref.w ?? 512), h: clampDim(pref.h ?? 512), fit: pref.fit === 'contain' ? 'contain' : 'cover' };
    return { id: 'original', w: 512, h: 512, fit: 'cover' };
  });
  const [customW, setCustomW] = useState(String(fmt.w));
  const [customH, setCustomH] = useState(String(fmt.h));

  useEffect(() => {
    try { localStorage.setItem('gleetch-format', JSON.stringify(fmt)); } catch { /* ignore */ }
  }, [fmt]);

  const capForCustom = quality.maxCustomDim ?? 2048;
  const dimsInfo = useMemo(() => {
    const cw = parseInt(customW, 10);
    const ch = parseInt(customH, 10);
    const w = Number.isFinite(cw) ? cw : fmt.w;
    const h = Number.isFinite(ch) ? ch : fmt.h;
    // For original+upload we need img, otherwise ratio/custom
    if (fmt.id === 'custom') return resolveDims('custom', w, h, null, capForCustom);
    if (fmt.id === 'original' && mode === 'upload' && uploadedImg) return resolveDims('original', 0, 0, uploadedImg, capForCustom);
    return resolveDims(fmt.id, 0, 0, null, capForCustom);
  }, [fmt, customW, customH, mode, uploadedImg, capForCustom]);

  // Also compute actual capped by quality maxCanvasDim? We already capped via maxCustomDim per tier.
  // For original+upload, resolveDims already caps to capForCustom.
  const dims = { W: dimsInfo.W, H: dimsInfo.H };

  const [intensityDebounced, setIntensityDebounced] = useState(intensity);
  const [effectParamsDebounced, setEffectParamsDebounced] = useState(effectParams);

  useEffect(() => {
    const t = setTimeout(() => setIntensityDebounced(intensity), 80);
    return () => clearTimeout(t);
  }, [intensity]);

  useEffect(() => {
    const t = setTimeout(() => setEffectParamsDebounced(effectParams), 80);
    return () => clearTimeout(t);
  }, [effectParams]);

  const dimsMemo = useMemo(() => ({ W: dims.W, H: dims.H }), [dims.W, dims.H]);
  const run = useCallback(() => {
    const wc = workRef.current, oc = outRef.current;
    if (!wc || !oc) return;
    const { W, H } = dimsMemo;
    setBusy(true);
    const render = () => {
      const ctx = wc.getContext('2d', { willReadFrequently: true });
      wc.width = W; wc.height = H;
      oc.width = W; oc.height = H;
      if (mode === 'upload' && uploadedImg) {
        if (fmt.fit === 'contain') {
          ctx.fillStyle = '#0A0A1C';
          ctx.fillRect(0, 0, W, H);
          const scale = Math.min(W / uploadedImg.naturalWidth, H / uploadedImg.naturalHeight);
          const sw = uploadedImg.naturalWidth * scale;
          const sh = uploadedImg.naturalHeight * scale;
          ctx.drawImage(uploadedImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
        } else {
          drawImageCover(ctx, uploadedImg, W, H);
        }
      } else {
        try { renderProcedural(ctx, W, H, seed, { maxLayers: quality.maxLayers ?? 3 }); }
        catch { ctx.fillStyle = '#FF2D6B'; ctx.fillRect(0, 0, W, H); }
      }
      let buf = ctx.getImageData(0, 0, W, H).data;
      buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity: intensityDebounced, channel }, prng(seed + 999), effectParamsDebounced);
      let outImgData = outImageDataRef.current;
      if (!outImgData || outImgData.width !== W || outImgData.height !== H) {
        outImgData = oc.getContext('2d').createImageData(W, H);
        outImageDataRef.current = outImgData;
      }
      outImgData.data.set(buf);
      oc.getContext('2d').putImageData(outImgData, 0, 0);
    };
    setTimeout(() => {
      try { render(); }
      catch (err) { console.error('VisualTab render failed:', err); }
      finally { setBusy(false); }
    }, 10);
  }, [seed, mode, uploadedImg, algos, intensityDebounced, channel, dimsMemo, effectParamsDebounced, fmt.fit, quality.maxLayers]);

  useEffect(() => { run(); }, [run]);

  const withoutOrRefill = (chain, id) => chain.filter((a) => a !== id);

  const applyPreset = (k) => { const p = IMAGE_PRESETS[k]; setAlgos(p.algos); setIntensity(p.intensity); setPreset(k); };
  const toggleAlgo = (id) => { setPreset(null); setAlgos((p) => (p.includes(id) ? withoutOrRefill(p, id) : [...p, id])); };
  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try { localStorage.setItem('gleetch-favorites', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const shuffle = () => {
    const rng = prng(randomSeed());
    setPreset(null);
    let chain = randomEffectSelection('image', rng, { previousChain: algos });
    let intensity = 0.3 + rng() * 0.6;
    for (let attempt = 0; attempt < 3; attempt++) {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 64; testCanvas.height = 64;
      const testCtx = testCanvas.getContext('2d');
      try { renderProcedural(testCtx, 64, 64, seed, { maxLayers: 1 }); } catch { testCtx.fillStyle = '#1a1a2e'; testCtx.fillRect(0, 0, 64, 64); }
      const before = testCtx.getImageData(0, 0, 64, 64).data;
      const after = applyEffectChain(new Uint8ClampedArray(before), chain, { mediaType: 'image', W: 64, H: 64, intensity, channel }, prng(seed + 999), {});
      if (!isNoOp(before, after)) break;
      chain = randomEffectSelection('image', rng, { previousChain: algos });
      intensity = 0.3 + rng() * 0.6;
    }
    setAlgos(chain);
    setIntensity(intensity);
    if (!seedLocked) onReroll();
  };

  const download = (format = 'png') => {
    const oc = outRef.current; if (!oc) return;
    const a = document.createElement('a');
    a.href = format === 'jpg' ? oc.toDataURL('image/jpeg', 0.92) : oc.toDataURL('image/png');
    a.download = `gleetch-${String(seed).padStart(6, '0')}-${dims.W}x${dims.H}.${format === 'jpg' ? 'jpg' : 'png'}`;
    a.click();
  };

  const exportFullRes = () => {
    setExporting(true);
    setExportProgress(0);
    // Scale the CURRENT format dims (whatever the FORMAT row above holds),
    // preserving aspect — not a fixed-aspect preset.
    const { W, H } = resolveExportDims(exportScale, dims.W, dims.H);
    const hasUpload = mode === 'upload' && uploadedImg;
    const useWorker = typeof Worker !== 'undefined' && W * H > 512 * 512;
    const saveBlob = (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gleetch-${String(seed).padStart(6, '0')}-${W}x${H}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExporting(false);
    };
    const fail = (err) => { console.error('Export failed:', err); setExporting(false); };
    if (useWorker) {
      const worker = new Worker(new URL('../core/render.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (e.data.type === 'progress') setExportProgress(e.data.value);
        else if (e.data.type === 'done') { worker.terminate(); saveBlob(e.data.blob); }
        else if (e.data.type === 'error') { worker.terminate(); fail(new Error(e.data.message)); }
      };
      const base = { seed, algos, intensity, channel, effectParams, W, H, maxLayers: quality.maxLayers ?? 3, fit: fmt.fit };
      if (hasUpload) {
        // Transfer the upload as an ImageBitmap so the worker starts from
        // the user's image at export size (previously it always rendered
        // procedural, exporting the wrong content in upload mode).
        createImageBitmap(uploadedImg).then((bitmap) => {
          worker.postMessage({ ...base, source: bitmap }, [bitmap]);
        }).catch((err) => { worker.terminate(); fail(err); });
      } else {
        worker.postMessage(base);
      }
    } else {
      setTimeout(() => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          if (hasUpload) {
            drawFittedImage(ctx, uploadedImg, W, H, fmt.fit);
            let buf = ctx.getImageData(0, 0, W, H).data;
            buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity, channel }, prng(seed + 999), effectParams);
            const imgData = ctx.createImageData(W, H);
            imgData.data.set(buf);
            ctx.putImageData(imgData, 0, 0);
          } else {
            const buf = renderStill({ seed, algos, intensity, channel, effectParams, W, H, maxLayers: quality.maxLayers ?? 3, dither: true });
            const imgData = ctx.createImageData(W, H);
            imgData.data.set(buf);
            ctx.putImageData(imgData, 0, 0);
          }
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = `gleetch-${String(seed).padStart(6, '0')}-${W}x${H}.png`;
          a.click();
        } catch (err) { console.error('Export failed:', err); }
        finally { setExporting(false); }
      }, 10);
    }
  };

  const updatePreview = useCallback(() => {
    const pc = previewRef.current;
    if (!pc || !showPreview) return;
    const { W, H } = dimsMemo;
    pc.width = W; pc.height = H;
    const pctx = pc.getContext('2d', { willReadFrequently: true });
    try { renderProcedural(pctx, W, H, seed, { maxLayers: quality.maxLayers ?? 3 }); }
    catch { pctx.fillStyle = '#1a1a2e'; pctx.fillRect(0, 0, W, H); }
    let buf = pctx.getImageData(0, 0, W, H).data;
    buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity: intensityDebounced, channel }, prng(seed + 999), effectParamsDebounced);
    const imgData = pctx.createImageData(W, H);
    imgData.data.set(buf);
    pctx.putImageData(imgData, 0, 0);
  }, [showPreview, dimsMemo, seed, algos, intensityDebounced, channel, effectParamsDebounced, quality.maxLayers]);

  useEffect(() => { if (showPreview) updatePreview(); }, [updatePreview, showPreview]);

  const copy = () => {
    const oc = outRef.current; if (!oc) return;
    oc.toBlob(async (blob) => {
      // toBlob yields null when the canvas has no image data to encode —
      // fall back to download instead of crashing on a null Blob.
      if (!blob) { download(); return; }
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
      catch { download(); }
    });
  };

  const onDropImage = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f?.type.startsWith('image/')) return;
    try { setUploadedImg(await loadImageFile(f)); setMode('upload'); }
    catch (err) { console.error('Image load error:', err); }
  };

  const seedStr = String(seed).padStart(6, '0');

  const fmtId = fmt.id;
  // Export dims scale the current format (recomputed every render — pure math).
  const exportDims = resolveExportDims(exportScale, dims.W, dims.H);
  const applyFmt = (id) => {
    if (id === 'custom') {
      const w = clampDim(parseInt(customW, 10) || fmt.w);
      const h = clampDim(parseInt(customH, 10) || fmt.h);
      setFmt((prev) => ({ ...prev, id, w, h }));
    } else {
      setFmt((prev) => ({ ...prev, id }));
    }
  };

  return (
    <>
      <canvas ref={workRef} width={dims.W} height={dims.H} style={{ display: 'none' }} />
      <aside className="sidebar">
        <div className="mode-row">
          <button className={`mode-btn ${mode === 'generate' ? 'on' : ''}`} onClick={() => setMode('generate')}>✦ GENERATE</button>
          <button className={`mode-btn ${mode === 'upload' ? 'on' : ''}`} onClick={() => setMode('upload')}>↑ UPLOAD</button>
        </div>

        {mode === 'upload' ? (
          <UploadZone label="IMAGE" subLabel="click · paste · drag & drop" loaded={!!uploadedImg}
            onFile={async (f) => {
              if (!f) return;
              try { setUploadedImg(await loadImageFile(f)); }
              catch (e) { console.error('Image load error:', e); }
            }} />
        ) : (
          <div className="gen-box">
            <div className="gen-icon">⟳</div>
            <div className="gen-text">PROCEDURAL · INFINITE LAYERS<br />pure randomness every roll</div>
          </div>
        )}

        <div className="div" />
        <span className="lbl">FORMAT — {dims.W}×{dims.H} {dimsInfo.capped ? '· capped' : ''}</span>
        <div className="fmt-row">
          {FORMATS.map((f) => (
            <button key={f.id} className={`fmt-btn ${fmtId === f.id ? 'on' : ''}`} onClick={() => applyFmt(f.id)}>{f.label}</button>
          ))}
        </div>
        {fmtId === 'custom' && (
          <div className="fmt-custom">
            <input className="fmt-input" type="number" min="64" max="2048" value={customW} onChange={(e) => setCustomW(e.target.value)} onBlur={() => setFmt((p) => ({ ...p, w: clampDim(parseInt(customW, 10) || p.w), h: p.h }))} placeholder="W" />
            <span style={{ color: '#4A4A80', fontSize: 10 }}>×</span>
            <input className="fmt-input" type="number" min="64" max="2048" value={customH} onChange={(e) => setCustomH(e.target.value)} onBlur={() => setFmt((p) => ({ ...p, w: p.w, h: clampDim(parseInt(customH, 10) || p.h) }))} placeholder="H" />
            <button className="fmt-apply" onClick={() => setFmt({ ...fmt, w: clampDim(parseInt(customW, 10) || fmt.w), h: clampDim(parseInt(customH, 10) || fmt.h) })}>APPLY</button>
          </div>
        )}
        <div className="fmt-fit-row">
          <span className="lbl" style={{ marginBottom: 0 }}>FIT</span>
          <button className={`fit-btn ${fmt.fit === 'cover' ? 'on' : ''}`} onClick={() => setFmt((p) => ({ ...p, fit: 'cover' }))}>COVER</button>
          <button className={`fit-btn ${fmt.fit === 'contain' ? 'on' : ''}`} onClick={() => setFmt((p) => ({ ...p, fit: 'contain' }))}>CONTAIN</button>
        </div>
        {dimsInfo.capped && <div className="sidebar-hint">capped by {quality.name} quality — switch to HIGH for full 2048</div>}

        <div className="div" />
        <span className="lbl">PRESETS</span>
        <PresetPanel presets={IMAGE_PRESETS} active={preset} onSelect={applyPreset} />
        <button className="adv-toggle" onClick={() => setShowAdv((v) => !v)}>{showAdv ? '▼' : '▶'} EFFECTS ({IMAGE_EFFECTS.length})</button>
        {showAdv && (
          <div className="algo-scroll">
            <AlgoPanel effects={IMAGE_EFFECTS} active={algos} onToggle={toggleAlgo} favorites={favorites} onToggleFavorite={toggleFavorite} />
            {algos.includes('pixelSort') && (
              <>
                <span className="lbl" style={{ marginTop: 8 }}>SORT CHANNEL</span>
                <div className="ch-row">
                  {V_CHANNELS.map((c) => (
                    <button key={c.id} className={`ch-btn ${channel === c.id ? 'on' : ''}`} onClick={() => setChannel(c.id)}>{c.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <ActiveChainList algos={algos} mediaType="image" onReorder={setAlgos} onRemove={(id) => setAlgos((p) => withoutOrRefill(p, id))} effectParams={effectParams} onParamsChange={setEffectParams} />

        <div className="div" />
        <div className="sec">
          <span className="lbl">INTENSITY — {(intensity * 100).toFixed(0)}%</span>
          <input type="range" className="slider" min="0" max="1" step=".01"
            value={intensity} onChange={(e) => { setPreset(null); setIntensity(parseFloat(e.target.value)); }} />
        </div>
        <div className="div" />
        <div className="seed-row"><span className="seed-lbl">SEED</span><span className="seed-val">#{seedStr}</span>
          <button className={`seed-lock-btn ${seedLocked ? 'locked' : ''}`} onClick={() => onSeedLockChange(!seedLocked)} title={seedLocked ? 'Unlock seed (shuffle will re-roll)' : 'Lock seed (shuffle keeps base pattern)'}>
            {seedLocked ? '🔒' : '🔓'}
          </button>
        </div>
        <button className="reroll-btn" onClick={onReroll} disabled={busy}>{busy ? 'RENDERING...' : '⟳  RE-ROLL'}</button>
        <ShuffleButton onClick={shuffle} disabled={busy} />
        <div className="action-row">
          <button className="act-btn" onClick={() => download('png')}>↓ PNG</button>
          <button className="act-btn" onClick={() => download('jpg')}>↓ JPG</button>
          <button className="act-btn" onClick={copy}>⎘ COPY</button>
        </div>
        <div className="div" />
        <span className="lbl">EXPORT FULL RES — scales the format above</span>
        <div className="fmt-row">
          {EXPORT_SCALES.map((p) => (
            <button key={p.id} className={`fmt-btn ${exportScale === p.id ? 'on' : ''}`} onClick={() => setExportScale(p.id)}>{p.label}</button>
          ))}
        </div>
        <button className="act-btn" onClick={exportFullRes} disabled={exporting}>
          {exporting ? `EXPORTING... ${(exportProgress * 100).toFixed(0)}%` : `↓ EXPORT ${exportDims.W}×${exportDims.H}`}
        </button>
        {exportDims.capped && <div className="sidebar-hint">capped at 4096 long edge</div>}
        <button className="adv-toggle" onClick={() => setShowPreview(!showPreview)}>{showPreview ? '▼' : '▶'} LIVE PREVIEW IN FORMAT</button>
        {showPreview && <canvas ref={previewRef} className="preview-canvas" style={{ width: '100%', marginTop: 8, borderRadius: 4 }} />}
        <CopyRecipeButton getRecipe={() => ({ t: 'visual', s: seed, a: algos, i: intensity, c: channel, p: effectParams, f: { id: fmt.id, w: dims.W, h: dims.H, fit: fmt.fit } })} />
      </aside>
      <main className="main">
        <div className="canvas-wrap" onDragOver={(e) => e.preventDefault()} onDrop={onDropImage}>
          <canvas ref={outRef} width={dims.W} height={dims.H} className="out-canvas" />
          <div className="crt" />
          {busy && <div className="busy-ov"><span className="busy-lbl"><ScrambleText text="RENDERING" active={busy} /></span></div>}
        </div>
        <div className="canvas-meta">
          <span>{dims.W}×{dims.H} · PNG</span><span>SEED #{seedStr}</span>
          <span>ITER {String(iter).padStart(4, '0')}</span>
          <span>{algos.length} EFFECT{algos.length !== 1 ? 'S' : ''}</span>
        </div>
        <div className="canvas-hint">quality: {quality.name} · {dims.W}×{dims.H} · {quality.enableHeavyEffects ? 'all effects' : 'heavy effects disabled'} {fmtId !== 'original' ? `· ${fmtId}` : ''}</div>
      </main>
    </>
  );
}
