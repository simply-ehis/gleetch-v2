import { useState, useRef, useCallback, useEffect } from 'react';
import { prng } from '../core/rng.js';
import { randomSeed } from '../core/constants.js';
import { encodeWAV } from '../core/wav-encoder.js';
import { processAudioBuffer } from '../effects/audio/process-buffer.js';
import { getEffectsFor, randomEffectSelection } from '../effects/registry.js';
import { AUDIO_PRESETS } from '../effects/presets.js';
import AlgoPanel from './AlgoPanel.jsx';
import PresetPanel from './PresetPanel.jsx';
import UploadZone from './UploadZone.jsx';
import ShuffleButton from './ShuffleButton.jsx';
import ScrambleText from './ScrambleText.jsx';
import ActiveChainList from './ActiveChainList.jsx';
import CopyRecipeButton from './CopyRecipeButton.jsx';
import { useQuality } from '../core/quality.jsx';

const AUDIO_EFFECTS = getEffectsFor('audio');

function drawWaveform(canvas, audioBuffer, step = 1) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#0A0A1C';
  ctx.fillRect(0, 0, w, h);
  const ch = audioBuffer.getChannelData(0);
  ctx.strokeStyle = '#FF2D6B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    let max = 0;
    for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(ch[x * step + j] || 0));
    const y = (1 - max) * h / 2;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export default function AudioTab({ seed, onReroll, initialRecipe, seedLocked, onSeedLockChange }) {
  const { current: quality } = useQuality();
  
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [duration, setDuration] = useState(null);
  const [algos, setAlgos] = useState(initialRecipe?.a ?? ['bitCrush', 'stutter']);
  const [intensity, setIntensity] = useState(initialRecipe?.i ?? 0.5);
  const [effectParams, setEffectParams] = useState(initialRecipe?.p ?? {});
  const [preset, setPreset] = useState(null);
  const [showAdv, setShowAdv] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gleetch-favorites') || '[]'); } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const waveCanvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioSrcRef = useRef(null);

  const loadAudio = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext();
      const decoded = await audioCtxRef.current.decodeAudioData(await file.arrayBuffer());
      setAudioBuffer(decoded);
      setDuration(decoded.duration);
      setTimeout(() => waveCanvasRef.current && drawWaveform(waveCanvasRef.current, decoded, quality.waveformSteps), 50);
    } catch (e) { console.error('Audio load error:', e); }
    setBusy(false);
  }, [quality.waveformSteps]);

  const runAudio = useCallback(async () => {
    if (!audioBuffer || !audioCtxRef.current) return;
    if (audioSrcRef.current) { try { audioSrcRef.current.stop(); } catch { /* already stopped */ } audioSrcRef.current = null; }
    setPlaying(false);
    setBusy(true);
    try {
      const ac = audioCtxRef.current;
      await ac.resume();
      const processedBuf = processAudioBuffer(ac, audioBuffer, algos, intensity, seed, effectParams);
      const src = ac.createBufferSource();
      src.buffer = processedBuf;
      src.connect(ac.destination);
      src.onended = () => setPlaying(false);
      src.start();
      audioSrcRef.current = src;
      setPlaying(true);
    } catch (e) { console.error(e); }
    setBusy(false);
  }, [audioBuffer, algos, intensity, seed, effectParams]);

  const stopAudio = useCallback(() => {
    if (audioSrcRef.current) { try { audioSrcRef.current.stop(); } catch { /* already stopped */ } audioSrcRef.current = null; }
    setPlaying(false);
  }, []);

  useEffect(() => () => {
    if (audioSrcRef.current) { try { audioSrcRef.current.stop(); } catch { /* already stopped */ } }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(() => {});
  }, []);

  const downloadAudio = useCallback(() => {
    if (!audioBuffer || !audioCtxRef.current) return;
    const processedBuf = processAudioBuffer(audioCtxRef.current, audioBuffer, algos, intensity, seed, effectParams);
    const blob = new Blob([encodeWAV(processedBuf)], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gleetch-audio-${String(seed).padStart(6, '0')}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [audioBuffer, algos, intensity, seed, effectParams]);

  const applyPreset = (k) => { const p = AUDIO_PRESETS[k]; setAlgos(p.algos); setIntensity(p.intensity); setPreset(k); };
  const toggleAlgo = (id) => { setPreset(null); setAlgos((p) => (p.includes(id) ? p.filter((a) => a !== id) : [...p, id])); };
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
    setAlgos(randomEffectSelection('audio', rng, { exclude: algos }));
    setIntensity(0.2 + rng() * 0.65);
    if (!seedLocked) onReroll();
  };

  const seedStr = String(seed).padStart(6, '0');

  return (
    <>
      <aside className="sidebar">
        <UploadZone label="AUDIO" subLabel="mp3 · wav · ogg · flac · m4a" loaded={!!audioBuffer} onFile={loadAudio} accept="audio/*" />
        <div className="div" />
        <span className="lbl">PRESETS</span>
        <PresetPanel presets={AUDIO_PRESETS} active={preset} onSelect={applyPreset} />
        <button className="adv-toggle" onClick={() => setShowAdv((v) => !v)}>{showAdv ? '▼' : '▶'} EFFECTS ({AUDIO_EFFECTS.length})</button>
        {showAdv && <div className="algo-scroll"><AlgoPanel effects={AUDIO_EFFECTS} active={algos} onToggle={toggleAlgo} favorites={favorites} onToggleFavorite={toggleFavorite} /></div>}
        <ActiveChainList algos={algos} mediaType="audio" onReorder={setAlgos} onRemove={(id) => setAlgos((p) => p.filter((a) => a !== id))} effectParams={effectParams} onParamsChange={setEffectParams} />
        <div className="div" />
        <div className="sec">
          <span className="lbl">INTENSITY — {(intensity * 100).toFixed(0)}%</span>
          <input type="range" className="slider" min=".05" max="1" step=".01"
            value={intensity} onChange={(e) => { setPreset(null); setIntensity(parseFloat(e.target.value)); }} />
        </div>
        <div className="div" />
        <div className="seed-row"><span className="seed-lbl">SEED</span><span className="seed-val">#{seedStr}</span>
          <button className={`seed-lock-btn ${seedLocked ? 'locked' : ''}`} onClick={() => onSeedLockChange(!seedLocked)} title={seedLocked ? 'Unlock seed (shuffle will re-roll)' : 'Lock seed (shuffle keeps base pattern)'}>
            {seedLocked ? '🔒' : '🔓'}
          </button>
        </div>
        <button className="reroll-btn" onClick={onReroll}>⟳  NEW SEED</button>
        <ShuffleButton onClick={shuffle} />
        <CopyRecipeButton getRecipe={() => ({ t: 'audio', s: seed, a: algos, i: intensity, p: effectParams })} />
      </aside>
      <main className="main">
        <canvas ref={waveCanvasRef} className="waveform-canvas" width={512} height={80} />
        {duration && <div className="stat-badge">DURATION: {duration.toFixed(2)}s · LOADED</div>}
        <div className="audio-controls">
          <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={playing ? stopAudio : runAudio} disabled={!audioBuffer || busy}>
            {busy ? <ScrambleText text="PROCESSING" active={busy} /> : playing ? '■ STOP' : '▶ PLAY GLITCHED'}
          </button>
          <button className="act-btn" onClick={downloadAudio} disabled={!audioBuffer}>↓ WAV</button>
        </div>
        {!audioBuffer && <div className="audio-info">UPLOAD AUDIO TO BEGIN · all glitch happens in-browser · exports as WAV</div>}
        <div className="audio-info" style={{ marginTop: 8 }}>{algos.length} EFFECT{algos.length !== 1 ? 'S' : ''} ACTIVE · SEED #{seedStr} · quality: {quality.name}</div>
      </main>
    </>
  );
}