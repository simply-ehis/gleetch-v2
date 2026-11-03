import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { prng } from '../core/rng.js';
import { loadImageFile, drawImageCover, drawFittedImage, makeOffscreenCanvas } from '../core/canvas-utils.js';
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
import LayersPanel from './LayersPanel.jsx';
import { useQuality } from '../core/quality.jsx';
import { renderStill, EXPORT_SCALES, resolveExportDims } from '../core/render-still.js';
import { renderLayer1, renderLayer2, renderLayer3 } from '../core/layers.js';
import { shuffle3, BASE_FAMILIES } from '../core/shuffle3.js';

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
  const [buildMode, setBuildMode] = useState(initialRecipe?.b ?? false);
  const [layerRecipe, setLayerRecipe] = useState(initialRecipe?.l ?? null);
  const [colourPasses, setColourPasses] = useState(initialRecipe?.l?.colour?.passes ?? []);
  const [baseFamily, setBaseFamily] = useState(layerRecipe?.family ?? 'beauty');
  const [baseEngineBusy, setBaseEngineBusy] = useState(false);

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
    if (fmt.id === 'custom') return resolveDims('custom', w, h, null, capForCustom);
    if (fmt.id === 'original' && mode === 'upload' && uploadedImg) return resolveDims('original', 0, 0, uploadedImg, capForCustom);
    return resolveDims(fmt.id, 0, 0, null, capForCustom);
  }, [fmt, customW, customH, mode, uploadedImg, capForCustom]);

  const dims = { W: dimsInfo.W, H: dimsInfo.H };

  const [intensityDebounced, setIntensityDebounced] = useState(intensity);
  const [effectParamsDebounced, setEffectParamsDebounced] = useState(effectParams);
  const [colourPassesDebounced, setColourPassesDebounced] = useState(colourPasses);

  useEffect(() => {
    const t = setTimeout(() => setIntensityDebounced(intensity), 80);
    return () => clearTimeout(t);
  }, [intensity]);

  useEffect(() => {
    const t = setTimeout(() => setEffectParamsDebounced(effectParams), 80);
    return () => clearTimeout(t);
  }, [effectParams]);

  useEffect(() => {
    const t = setTimeout(() => setColourPassesDebounced(colourPasses), 80);
    return () => clearTimeout(t);
  }, [colourPasses]);

  const dimsMemo = useMemo(() => ({ W: dims.W, H: dims.H }), [dims.W, dims.H]);

  // ── Render pipeline: Layer 1 (base) → Layer 2 (effects) → Layer 3 (colour) ──
  const run = useCallback(async () => {
    const wc = workRef.current, oc = outRef.current;
    if (!wc || !oc) return;
    const { W, H } = dimsMemo;
    setBusy(true);
    const render = async () => {
      try {
        let baseBuf;
        if (mode === 'upload' && uploadedImg) {
          // Layer 1 = the uploaded image (no procedural base).
          const c = makeOffscreenCanvas(W, H);
          const ctx = c.getContext('2d', { willReadFrequently: true });
          c.width = W; c.height = H;
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
          baseBuf = ctx.getImageData(0, 0, W, H);
        } else {
          // Layer 1 = procedural base (three-layer shuffle recipe or fresh).
          const recipe = layerRecipe ?? { seed, tier: quality.name.toLowerCase() };
          setBaseEngineBusy(true);
          try {
            baseBuf = await renderLayer1(recipe, W, H, { baseRecipe: layerRecipe?.base?.recipe });
          } finally {
            setBaseEngineBusy(false);
          }
        }

        // Layer 2 = effect stack on the base.
        const ctx2 = { mediaType: 'image', W, H, intensity: intensityDebounced, channel: 0 };
        const fxBuf = renderLayer2({ seed, effects: algos, intensity: intensityDebounced, channel: 0 }, baseBuf, W, H, effectParamsDebounced);

        // Layer 3 = colour and paint passes (cheap final pass).
        const passes = colourPassesDebounced.length ? colourPassesDebounced : (layerRecipe?.colour?.passes ?? []);
        const final = renderLayer3({ colour: { passes } }, fxBuf, W, H);

        let outImgData = outImageDataRef.current;
        if (!outImgData || outImgData.width !== W || outImgData.height !== H) {
          outImgData = oc.getContext('2d').createImageData(W, H);
          outImageDataRef.current = outImgData;
        }
        outImgData.data.set(final.data);
        oc.getContext('2d').putImageData(outImgData, 0, 0);
      } catch (err) {
        console.error('VisualTab render failed:', err);
        const ctx = oc.getContext('2d');
        ctx.fillStyle = '#FF2D6B';
        ctx.fillRect(0, 0, W, H);
      } finally {
        setBusy(false);
      }
    };
    setTimeout(() => { render(); }, 10);
   }, [seed, mode, uploadedImg, algos, intensityDebounced, channel, dimsMemo, effectParamsDebounced, colourPassesDebounced, layerRecipe, fmt.fit, quality.name]);

  useEffect(() => { run(); }, [run]);

  const withoutOrRefill = (chain, id) => chain.filter((a) => a !== id);

  const applyPreset = (k) => { const p = IMAGE_PRESETS[k]; setAlgos(p.algos); setIntensity(p.intensity); setPreset(k); setLayerRecipe(null); };
  const toggleAlgo = (id) => { setPreset(null); setLayerRecipe(null); setAlgos((p) => (p.includes(id) ? withoutOrRefill(p, id) : [...p, id])); };
  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try { localStorage.setItem('gleetch-favorites', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Three-layer shuffle: base → effects → colour. All or nothing.
  const shuffle = () => {
    const rng = prng(randomSeed());
    setPreset(null);
    setLayerRecipe(null);
    const result = shuffle3({ seed, tier: quality.name.toLowerCase(), family: baseFamily, rng });
    setBaseFamily(result.family);
    setLayerRecipe(result);
    setAlgos(result.effects);
    setIntensity(result.intensity);
    setColourPasses(result.colour.passes);
    if (!seedLocked) onReroll();
  };

  // Re-roll base within the current family (build mode or shuffle).
  const rerollBase = () => {
    const rng = prng(randomSeed());
    const result = shuffle3({ seed, tier: quality.name.toLowerCase(), family: baseFamily, rng });
    setBaseFamily(result.family);
    setLayerRecipe(result);
    setAlgos(result.effects);
    setIntensity(result.intensity);
    setColourPasses(result.colour.passes);
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
      const base = { seed, algos, intensity, channel, effectParams, W, H, maxLayers: quality.maxLayers ?? 3, fit: fmt.fit, layerRecipe, colourPasses };
      if (hasUpload) {
        createImageBitmap(uploadedImg).then((bitmap) => {
          worker.postMessage({ ...base, source: bitmap }, [bitmap]);
        }).catch((err) => { worker.terminate(); fail(err); });
      } else {
        worker.postMessage(base);
      }
    } else {
      setTimeout(async () => {
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
            const buf = await renderStill({ seed, algos, intensity, channel, effectParams, W, H, maxLayers: quality.maxLayers ?? 3, dither: true, layerRecipe, colourPasses });
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
    try {
      const baseBuf = renderProcedural(pctx, W, H, seed, { maxLayers: quality.maxLayers ?? 3 }) || pctx.getImageData(0, 0, W, H);
      let buf = baseBuf.data;
      buf = applyEffectChain(buf, algos, { mediaType: 'image', W, H, intensity: intensityDebounced, channel }, prng(seed + 999), effectParamsDebounced);
      const passes = colourPassesDebounced.length ? colourPassesDebounced : (layerRecipe?.colour?.passes ?? []);
      const final = renderLayer3({ colour: { passes } }, { data: buf, width: W, height: H }, W, H);
      const imgData = pctx.createImageData(W, H);
      imgData.data.set(final.data);
      pctx.putImageData(imgData, 0, 0);
    } catch { pctx.fillStyle = '#1a1a2e'; pctx.fillRect(0, 0, W, H); }
  }, [showPreview, dimsMemo, seed, algos, intensityDebounced, channel, effectParamsDebounced, colourPassesDebounced, layerRecipe, quality.maxLayers]);

  useEffect(() => { if (showPreview) updatePreview(); }, [updatePreview, showPreview]);

  const copy = () => {
    const oc = outRef.current; if (!oc) return;
    oc.toBlob(async (blob) => {
      if (!blob) { download(); return; }
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
      catch { download(); }
    });
  };

  const onDropImage = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f?.type.startsWith('image/')) return;
    try { setUploadedImg(await loadImageFile(f)); setMode('upload'); setLayerRecipe(null); setBuildMode(false); }
    catch (err) { console.error('Image load error:', err); }
  };

  const seedStr = String(seed).padStart(6, '0');
  const fmtId = fmt.id;
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

  const tierLabel = quality.name;

  return (
    <>
      <canvas ref={workRef} width={dims.W} height={dims.H} style={{ display: 'none' }} />
      <aside className="sidebar">
        <div className="mode-row">
          <button className={`mode-btn ${mode === 'generate' ? 'on' : ''}`} onClick={() => { setMode('generate'); setBuildMode(false); setLayerRecipe(null); }}>✦ GENERATE</button>
          <button className={`mode-btn ${mode === 'upload' ? 'on' : ''}`} onClick={() => { setMode('upload'); setBuildMode(false); setLayerRecipe(null); }}>↑ UPLOAD</button>
          <button className={`mode-btn ${buildMode ? 'on' : ''}`} onClick={() => setBuildMode((v) => { const n = !v; setLayerRecipe(null); return n; })}>🛠 BUILD</button>
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
            <div className="gen-text">PROCEDURAL · INFINITE LAYERS<br />{buildMode ? 'manual base · effects · colour' : 'base → effects → colour'}</div>
            {buildMode && baseEngineBusy && <div className="sidebar-hint" style={{ fontSize: 10, color: '#8a8f98', marginTop: 4 }}>base engine loading…</div>}
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
        {dimsInfo.capped && <div className="sidebar-hint">capped by {tierLabel} quality — switch to HIGH for full 2048</div>}

        <div className="div" />

        {/* Build mode: base family picker */}
        {buildMode && (
          <>
            <span className="lbl">BASE FAMILY</span>
            <div className="fmt-row">
              {Object.entries(BASE_FAMILIES).map(([id, label]) => (
                <button key={id} className={`fmt-btn ${baseFamily === id ? 'on' : ''}`} onClick={() => { setBaseFamily(id); rerollBase(); }}>{label}</button>
              ))}
            </div>
            <button className="act-btn" onClick={rerollBase} disabled={busy || baseEngineBusy}>{busy || baseEngineBusy ? 'RENDERING…' : '⟳ NEW BASE'}</button>
            {layerRecipe && (
              <div className="sidebar-hint" style={{ fontSize: 10, color: '#8a8f98', marginTop: 4 }}>
                {layerRecipe.base.recipe.name} · {layerRecipe.effects.length} fx · cost {layerRecipe.effectCost}
              </div>
            )}
            <div className="div" />
          </>
        )}

        <span className="lbl">PRESETS</span>
        <PresetPanel presets={IMAGE_PRESETS} active={preset} onSelect={applyPreset} />
        <button className="adv-toggle" onClick={() => setShowAdv((v) => !v)}>{showAdv ? '▼' : '▶'} EFFECTS {IMAGE_EFFECTS.length}</button>
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
        <ActiveChainList algos={algos} mediaType="image" onReorder={setAlgos} onRemove={(id) => { setLayerRecipe(null); setAlgos((p) => withoutOrRefill(p, id)); }} effectParams={effectParams} onParamsChange={setEffectParams} />

        <div className="div" />
        <div className="sec">
          <span className="lbl">INTENSITY — {(intensity * 100).toFixed(0)}%</span>
          <input type="range" className="slider" min="0" max="1" step=".01"
            value={intensity} onChange={(e) => { setPreset(null); setLayerRecipe(null); setIntensity(parseFloat(e.target.value)); }} />
        </div>
        <div className="div" />
        <div className="seed-row"><span className="seed-lbl">SEED</span><span className="seed-val">#{seedStr}</span>
          <button className={`seed-lock-btn ${seedLocked ? 'locked' : ''}`} onClick={() => onSeedLockChange(!seedLocked)} title={seedLocked ? 'Unlock seed (shuffle will re-roll)' : 'Lock seed (shuffle keeps base pattern)'}>
            {seedLocked ? '🔒' : '🔓'}
          </button>
        </div>
        <button className="reroll-btn" onClick={onReroll} disabled={busy}>{busy ? 'RENDERING...' : '⟳  RE-ROLL'}</button>
        <ShuffleButton onClick={shuffle} disabled={busy || baseEngineBusy} label={buildMode ? 'RESHUFFLE LAYERS' : 'SHUFFLE EFFECTS'} />

        {/* Three-layer panels (Base / Effects / Colour) */}
        <LayersPanel
          seed={seed}
          algos={algos}
          onAlgosChange={(next) => { setLayerRecipe(null); setAlgos(next); }}
          intensity={intensity}
          onIntensityChange={setIntensity}
          colourPasses={colourPasses}
          onColourPassesChange={setColourPasses}
          collapsed={!buildMode}
          onToggleCollapsed={() => {}}
          layerRecipe={layerRecipe}
          onBaseReroll={rerollBase}
          baseFamily={baseFamily}
          onBaseFamilyChange={(id) => { setBaseFamily(id); rerollBase(); }}
        />

        <div className="div" />
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
        <CopyRecipeButton getRecipe={() => ({
          t: 'visual', s: seed, a: algos, i: intensity, c: channel, p: effectParams,
          f: { id: fmt.id, w: dims.W, h: dims.H, fit: fmt.fit },
          b: buildMode,
          l: layerRecipe,
        })} />
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
        <div className="canvas-hint">quality: {tierLabel} · {dims.W}×{dims.H} · {quality.enableHeavyEffects ? 'all effects' : 'heavy effects disabled'} {fmtId !== 'original' ? `· ${fmtId}` : ''} {buildMode ? '· BUILD MODE' : ''}</div>
      </main>
    </>
  );
}
