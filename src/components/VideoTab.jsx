/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps -- procedural video uses ref indirection intentionally, mirrors existing upload loop pattern */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { prng } from '../core/rng.js';
import { randomSeed } from '../core/constants.js';
import { getEffectsFor, applyVideoEffectChain, applyEffectChain, randomEffectSelection } from '../effects/registry.js';
import { IMAGE_PRESETS } from '../effects/presets.js';
import { renderProceduralVideoFrame } from '../core/procedural-video.js';
import { useVideoAudioTrack } from './useVideoAudioTrack.js';
import { useVideoExport } from './useVideoExport.js';
import VideoAudioTrackPanel from './VideoAudioTrackPanel.jsx';
import AlgoPanel from './AlgoPanel.jsx';
import PresetPanel from './PresetPanel.jsx';
import UploadZone from './UploadZone.jsx';
import ShuffleButton from './ShuffleButton.jsx';
import ScrambleText from './ScrambleText.jsx';
import ActiveChainList from './ActiveChainList.jsx';
import CopyRecipeButton from './CopyRecipeButton.jsx';
import { useQuality } from '../core/quality.jsx';

const VIDEO_EFFECTS = getEffectsFor('video');
const AUDIO_TRACK_EFFECTS = getEffectsFor('audio');

export default function VideoTab({ seed, onReroll, initialRecipe, seedLocked, onSeedLockChange }) {
  const { current: quality } = useQuality();

  const [mode, setMode] = useState('generate');
  const [videoFile, setVideoFile] = useState(null);
  const [algos, setAlgos] = useState(initialRecipe?.a ?? ['pixelSort', 'chanShift']);
  const [intensity, setIntensity] = useState(initialRecipe?.i ?? 0.55);
  const [effectParams, setEffectParams] = useState(initialRecipe?.p ?? {});
  const [preset, setPreset] = useState(null);
  const [showAdv, setShowAdv] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gleetch-favorites') || '[]'); } catch { return []; }
  });
  const [showAudioTrack, setShowAudioTrack] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [fqBusy, setFqBusy] = useState(false);
  const [motionStyle, setMotionStyle] = useState('Calm');
  const [motionSpeed, setMotionSpeed] = useState(1);
  const [seamlessLoop, setSeamlessLoop] = useState(false);

  const videoRef = useRef(null);
  const workRef = useRef(null);
  const outRef = useRef(null);
  const animRef = useRef(null);
  const procAnimRef = useRef(null);
  const renderFrameRef = useRef(null);
  const renderProcRef = useRef(null);
  const audioTrack = useVideoAudioTrack();

  const outImageDataRef = useRef(null);

  // Refs for stale-closure-free loops
  const algosRef = useRef(algos);
  const intensityRef = useRef(intensity);
  const seedRef = useRef(seed);
  const effectParamsRef = useRef(effectParams);
  const qualityRef = useRef(quality);
  const modeRef = useRef(mode);
  const heavyFrameRef = useRef(0);
  const procTimeRef = useRef(0);
  const procStartRef = useRef(0);
  const playingRef = useRef(playing);
  useEffect(() => { algosRef.current = algos; }, [algos]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { seedRef.current = seed; }, [seed]);
  useEffect(() => { effectParamsRef.current = effectParams; }, [effectParams]);
  useEffect(() => { qualityRef.current = quality; }, [quality]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const hasHeavyEffect = useMemo(() =>
    algos.some(id => {
      const eff = VIDEO_EFFECTS.find(e => e.id === id);
      return eff?.realtimeSafe === false;
    }), [algos]);

  const maxDim = quality.videoMaxDim;
  const targetFPS = quality.targetFPS;
  const frameInterval = 1000 / targetFPS;
  const heavyThrottle = quality.heavyEffectThrottle;

  // Procedural video dimensions: 16:9 based on maxDim (e.g. 720x405 at HIGH)
  const procDims = useMemo(() => {
    const W = maxDim;
    const H = Math.round((maxDim * 9) / 16);
    return { W: Math.max(64, W), H: Math.max(36, H) };
  }, [maxDim]);

  // --- Procedural render (global seed + time) ---
  const renderProceduralFrame = useCallback((timeMs = procTimeRef.current) => {
    const oc = outRef.current, wc = workRef.current;
    if (!oc || !wc) return;
    const { W: VW, H: VH } = procDims;
    if (wc.width !== VW) wc.width = VW;
    if (wc.height !== VH) wc.height = VH;
    if (oc.width !== VW) oc.width = VW;
    if (oc.height !== VH) oc.height = VH;

    const wctx = wc.getContext('2d', { willReadFrequently: true });
    // Global randomness: seed is the single source of truth from gleetch.jsx — same seed that drives VisualTab
    renderProceduralVideoFrame(wctx, VW, VH, seedRef.current, timeMs, { maxLayers: qualityRef.current.maxLayers ?? 3 });

    let buf = wctx.getImageData(0, 0, VW, VH).data;
    const clipSeed = seedRef.current;
    const frameSeed = seedRef.current + ((timeMs) | 0);
    const throttle = qualityRef.current.heavyEffectThrottle;
    const shouldProcessHeavy = qualityRef.current.enableHeavyEffects && hasHeavyEffect &&
      (throttle === 1 || heavyFrameRef.current % throttle === 0);
    heavyFrameRef.current++;

    buf = applyVideoEffectChain(buf, algosRef.current, {
      W: VW, H: VH, intensity: intensityRef.current, channel: 'brightness'
    }, clipSeed, frameSeed, effectParamsRef.current, shouldProcessHeavy);

    let outImgData = outImageDataRef.current;
    if (!outImgData || outImgData.width !== VW || outImgData.height !== VH) {
      outImgData = oc.getContext('2d').createImageData(VW, VH);
      outImageDataRef.current = outImgData;
    }
    outImgData.data.set(buf);
    oc.getContext('2d').putImageData(outImgData, 0, 0);
  }, [procDims, hasHeavyEffect]);

  // --- Upload video render ---
  const renderFrame = useCallback(() => {
    const vid = videoRef.current, oc = outRef.current, wc = workRef.current;
    if (!vid || !oc || !wc || vid.readyState < 2) return;
    const VW = Math.min(vid.videoWidth || 512, maxDim);
    const VH = Math.min(vid.videoHeight || 512, maxDim);
    if (wc.width !== VW) wc.width = VW;
    if (wc.height !== VH) wc.height = VH;
    if (oc.width !== VW) oc.width = VW;
    if (oc.height !== VH) oc.height = VH;

    const wctx = wc.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(vid, 0, 0, VW, VH);
    let buf = wctx.getImageData(0, 0, VW, VH).data;
    const clipSeed = seedRef.current;
    const frameSeed = seedRef.current + ((vid.currentTime * 1000) | 0);
    const throttle = qualityRef.current.heavyEffectThrottle;
    const shouldProcessHeavy = qualityRef.current.enableHeavyEffects && hasHeavyEffect &&
      (throttle === 1 || heavyFrameRef.current % throttle === 0);
    heavyFrameRef.current++;
    buf = applyVideoEffectChain(buf, algosRef.current, {
      W: VW, H: VH, intensity: intensityRef.current, channel: 'brightness'
    }, clipSeed, frameSeed, effectParamsRef.current, shouldProcessHeavy);
    let outImgData = outImageDataRef.current;
    if (!outImgData || outImgData.width !== VW || outImgData.height !== VH) {
      outImgData = oc.getContext('2d').createImageData(VW, VH);
      outImageDataRef.current = outImgData;
    }
    outImgData.data.set(buf);
    oc.getContext('2d').putImageData(outImgData, 0, 0);
    if (modeRef.current === 'upload' && !vid.paused) animRef.current = requestAnimationFrame(loopRef.current);
  }, [maxDim, hasHeavyEffect]);

  useEffect(() => { renderFrameRef.current = renderFrame; }, [renderFrame]);
  useEffect(() => { renderProcRef.current = renderProceduralFrame; }, [renderProceduralFrame]);

  // FPS-throttled loops
  const loopRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const loopUpload = () => {
    const vid = videoRef.current;
    if (modeRef.current !== 'upload' || !vid || vid.paused) return;
    const now = performance.now();
    if (now - lastFrameTimeRef.current >= frameInterval) {
      lastFrameTimeRef.current = now;
      renderFrameRef.current();
    } else {
      animRef.current = requestAnimationFrame(loopRef.current);
    }
  };
  const loopProcedural = useCallback(() => {
    if (modeRef.current !== 'generate' || !playingRef.current) return;
    const now = performance.now();
    if (now - lastFrameTimeRef.current >= frameInterval) {
      lastFrameTimeRef.current = now;
      const elapsed = now - procStartRef.current;
      procTimeRef.current = elapsed;
      renderProcRef.current(elapsed);
    }
    procAnimRef.current = requestAnimationFrame(loopProcedural);
  }, [frameInterval]);
  useEffect(() => { loopRef.current = loopUpload; }, [loopUpload]);

  // Re-render procedural frame when seed/effects change (global randomness)
  // Reset time to 0 on seed change so new seed always starts fresh, not mid-drift
  useEffect(() => {
    if (mode === 'generate') {
      procTimeRef.current = 0;
      procStartRef.current = performance.now();
      lastFrameTimeRef.current = 0;
      renderProceduralFrame(0);
    }
  }, [seed, algos, intensity, effectParams, mode, renderProceduralFrame]);

  // Auto-start procedural loop when entering generate mode
  useEffect(() => {
    if (mode === 'generate') {
      renderProceduralFrame(procTimeRef.current);
      if (playing) {
        procStartRef.current = performance.now() - procTimeRef.current;
        procAnimRef.current = requestAnimationFrame(loopProcedural);
      }
    }
    return () => { if (procAnimRef.current) cancelAnimationFrame(procAnimRef.current); };
  }, [mode, playing, renderProceduralFrame, loopProcedural]);

  const { exporting, captureFrame, captureFullQualityFrame, runExport, exportAudioOnly } = useVideoExport({
    videoRef, workRef, outRef, renderFrame, renderProceduralFrame, audioTrack, seed, maxDim, mode
  });

  const captureFullQuality = () => {
    setFqBusy(true);
    setTimeout(() => { captureFullQualityFrame(algos, intensity, effectParams); setFqBusy(false); }, 10);
  };

  // Procedural full-quality capture (image path so heavy effects included)
  const captureProceduralFullQuality = useCallback(() => {
    const wc = workRef.current;
    if (!wc) return;
    const { W: VW, H: VH } = procDims;
    const wctx = wc.getContext('2d', { willReadFrequently: true });
    renderProceduralVideoFrame(wctx, VW, VH, seed, procTimeRef.current, { maxLayers: quality.maxLayers ?? 3 });
    let buf = wctx.getImageData(0, 0, VW, VH).data;
    const frameSeed = seed + ((procTimeRef.current) | 0);
    buf = applyEffectChain(buf, algos, { W: VW, H: VH, mediaType: 'image', intensity, channel: 'brightness' }, prng(frameSeed), effectParams);
    const tmp = document.createElement('canvas');
    tmp.width = VW; tmp.height = VH;
    const tctx = tmp.getContext('2d');
    const od = tctx.createImageData(VW, VH);
    od.data.set(buf);
    tctx.putImageData(od, 0, 0);
    const a = document.createElement('a');
    a.href = tmp.toDataURL();
    a.download = `gleetch-proc-frame-full-${String(seed).padStart(6, '0')}.png`;
    a.click();
  }, [procDims, seed, algos, intensity, effectParams, quality.maxLayers]);

  const loadVideo = useCallback((file) => {
    if (!file) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.src) URL.revokeObjectURL(vid.src);
    vid.onloadedmetadata = () => {
      const oc = outRef.current;
      if (oc) { oc.width = Math.min(vid.videoWidth, maxDim); oc.height = Math.min(vid.videoHeight, maxDim); }
    };
    vid.onseeked = () => renderFrame();
    vid.src = URL.createObjectURL(file);
    vid.muted = true;
    vid.currentTime = 0;
    setVideoFile(file);
    setMode('upload');
    setPlaying(false);
    audioTrack.extract(file);
  }, [renderFrame, audioTrack, maxDim]);

  const toggleVideo = useCallback(() => {
    if (mode === 'generate') {
      if (playing) {
        setPlaying(false);
        if (procAnimRef.current) cancelAnimationFrame(procAnimRef.current);
      } else {
        setPlaying(true);
        procStartRef.current = performance.now() - procTimeRef.current;
        lastFrameTimeRef.current = 0;
        procAnimRef.current = requestAnimationFrame(loopProcedural);
      }
      return;
    }
    const vid = videoRef.current;
    if (!vid || !videoFile) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setPlaying(true);
      lastFrameTimeRef.current = 0;
      animRef.current = requestAnimationFrame(loopRef.current);
    } else {
      vid.pause();
      setPlaying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [videoFile, mode, playing]);

  const applyPreset = (k) => { const p = IMAGE_PRESETS[k]; setAlgos(p.algos); setIntensity(p.intensity); setPreset(k); };
  const toggleAlgo = (id) => { setPreset(null); setAlgos((p) => (p.includes(id) ? p.filter((a) => a !== id) : [...p, id])); };
  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try { localStorage.setItem('gleetch-favorites', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const toggleAudioAlgo = (id) => audioTrack.setAudioAlgos((p) => (p.includes(id) ? p.filter((a) => a !== id) : [...p, id]));

  const shuffle = () => {
    const rng = prng(randomSeed());
    setPreset(null);
    setAlgos(randomEffectSelection('video', rng, { previousChain: algos, realtimeOnly: true }));
    setIntensity(0.3 + rng() * 0.6);
    if (!seedLocked) onReroll();
  };

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (procAnimRef.current) cancelAnimationFrame(procAnimRef.current);
    if (videoRef.current?.src) URL.revokeObjectURL(videoRef.current.src);
  }, []);

  const seedStr = String(seed).padStart(6, '0');
  const isGenerate = mode === 'generate';

  return (
    <>
      <canvas ref={workRef} style={{ display: 'none' }} />
      <video ref={videoRef} style={{ display: 'none' }} playsInline loop
        onEnded={() => { setPlaying(false); if (animRef.current) cancelAnimationFrame(animRef.current); }} />
      <aside className="sidebar">
        <div className="mode-row">
          <button className={`mode-btn ${mode === 'generate' ? 'on' : ''}`} onClick={() => { setMode('generate'); setPlaying(true); procStartRef.current = performance.now() - procTimeRef.current; lastFrameTimeRef.current = 0; procAnimRef.current = requestAnimationFrame(loopProcedural); }}>✦ GENERATE</button>
          <button className={`mode-btn ${mode === 'upload' ? 'on' : ''}`} onClick={() => setMode('upload')}>↑ UPLOAD</button>
        </div>

        {mode === 'upload' ? (
          <UploadZone label="VIDEO" subLabel="mp4 · webm · mov" loaded={!!videoFile} onFile={loadVideo} accept="video/*" />
        ) : (
          <div className="gen-box">
            <div className="gen-icon">⟳</div>
            <div className="gen-text">PROCEDURAL VIDEO · infinite layers<br />no import needed — uses global seed</div>
          </div>
        )}

        <div className="div" />
        <span className="lbl">PRESETS</span>
        <PresetPanel presets={IMAGE_PRESETS} active={preset} onSelect={applyPreset} />
        <button className="adv-toggle" onClick={() => setShowAdv((v) => !v)}>{showAdv ? '▼' : '▶'} VISUAL EFFECTS ({VIDEO_EFFECTS.length})</button>
        {showAdv && <div className="algo-scroll"><AlgoPanel effects={VIDEO_EFFECTS} active={algos} onToggle={toggleAlgo} favorites={favorites} onToggleFavorite={toggleFavorite} /></div>}
        <ActiveChainList algos={algos} mediaType="video" onReorder={setAlgos} onRemove={(id) => setAlgos((p) => p.filter((a) => a !== id))} effectParams={effectParams} onParamsChange={setEffectParams} />
        <div className="div" />
        <div className="sec">
          <span className="lbl">INTENSITY — {(intensity * 100).toFixed(0)}%</span>
          <input type="range" className="slider" min="0" max="1" step=".01"
            value={intensity} onChange={(e) => { setPreset(null); setIntensity(parseFloat(e.target.value)); }} />
        </div>
        <div className="div" />
        <span className="lbl">MOTION</span>
        <div className="motion-row">
          {['Calm', 'Pulse', 'Glitch', 'Drift', 'Mixed'].map((s) => (
            <button key={s} className={`motion-btn ${motionStyle === s ? 'on' : ''}`} onClick={() => setMotionStyle(s)}>{s}</button>
          ))}
        </div>
        <div className="sec">
          <span className="lbl">SPEED — {motionSpeed.toFixed(1)}x</span>
          <input type="range" className="slider" min="0.1" max="3" step="0.1"
            value={motionSpeed} onChange={(e) => setMotionSpeed(parseFloat(e.target.value))} />
        </div>
        <button className={`fit-btn ${seamlessLoop ? 'on' : ''}`} onClick={() => setSeamlessLoop(!seamlessLoop)}>SEAMLESS LOOP</button>
        <div className="div" />
        {videoFile && mode === 'upload' && (
          <VideoAudioTrackPanel audioTrack={audioTrack} effects={AUDIO_TRACK_EFFECTS} show={showAudioTrack}
            onToggleShow={() => setShowAudioTrack((v) => !v)} onToggleAlgo={toggleAudioAlgo} />
        )}
        <div className="seed-row"><span className="seed-lbl">SEED</span><span className="seed-val">#{seedStr}</span><span className="seed-lbl" style={{ marginLeft: 6, fontSize: 8, opacity: 0.6 }}>GLOBAL</span>
          <button className={`seed-lock-btn ${seedLocked ? 'locked' : ''}`} onClick={() => onSeedLockChange(!seedLocked)} title={seedLocked ? 'Unlock seed (shuffle will re-roll)' : 'Lock seed (shuffle keeps base pattern)'}>
            {seedLocked ? '🔒' : '🔓'}
          </button>
        </div>
        <button className="reroll-btn" onClick={onReroll}>⟳  NEW SEED (GLOBAL)</button>
        <ShuffleButton onClick={shuffle} />
        <CopyRecipeButton getRecipe={() => ({ t: 'video', s: seed, a: algos, i: intensity, p: effectParams, m: mode })} />
      </aside>
      <main className="main">
        <canvas ref={outRef} className="video-output" width={procDims.W} height={procDims.H} />
        <div className="video-controls">
          <button className="play-btn" onClick={toggleVideo} disabled={exporting || (mode === 'upload' && !videoFile)}>
            {playing ? '■ PAUSE' : isGenerate ? '▶ PLAY PROCEDURAL' : '▶ PLAY GLITCHED'}
          </button>
          <button className="act-btn" onClick={isGenerate ? () => { const oc = outRef.current; if (!oc) return; const a=document.createElement('a'); a.href=oc.toDataURL(); a.download=`gleetch-proc-frame-${String(seed).padStart(6,'0')}.png`; a.click(); } : captureFrame} disabled={exporting || (mode === 'upload' && !videoFile)}>📷 FRAME PNG</button>
          <button className="act-btn" onClick={isGenerate ? captureProceduralFullQuality : captureFullQuality} disabled={fqBusy || (mode === 'upload' && !videoFile)}>
            {fqBusy ? <ScrambleText text="RENDERING" active={fqBusy} /> : '🎨 FULL QUALITY FRAME'}
          </button>
          <button className="export-btn" onClick={() => runExport(true, setPlaying)} disabled={exporting || (mode === 'upload' && !videoFile)}>
            {exporting ? <ScrambleText text="EXPORTING" active={exporting} /> : audioTrack.hasAudio && mode === 'upload' ? '⬇ EXPORT VIDEO+AUDIO' : '⬇ EXPORT VIDEO'}
          </button>
          {audioTrack.hasAudio && mode === 'upload' && (
            <>
              <button className="act-btn" onClick={() => runExport(false, setPlaying)} disabled={!videoFile || exporting}>⬇ VIDEO ONLY</button>
              <button className="act-btn" onClick={exportAudioOnly} disabled={!videoFile || exporting}>⬇ AUDIO ONLY</button>
            </>
          )}
        </div>
        {mode === 'generate' && <div className="audio-info">PROCEDURAL VIDEO · global seed {seedStr} · same randomness as VISUAL · SPACE re-rolls everywhere · export is 5s capture of the live canvas</div>}
        {mode === 'upload' && !videoFile && <div className="audio-info">UPLOAD VIDEO · or stay in GENERATE for infinite procedural video — no file needed</div>}
        <div className="canvas-hint">quality: {quality.name} · {isGenerate ? `${procDims.W}×${procDims.H} procedural` : `max dim: ${maxDim}px`} · {hasHeavyEffect && !quality.enableHeavyEffects ? 'heavy effects disabled' : hasHeavyEffect ? `throttled (1/${heavyThrottle} frames)` : 'all effects real-time'} · global seed</div>
      </main>
    </>
  );
}
