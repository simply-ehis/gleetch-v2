import { useState, useMemo } from 'react';
import { prng } from '../core/rng.js';
import { randomSeed } from '../core/constants.js';
import { getEffectsFor, applyEffectChain, randomEffectSelection } from '../effects/registry.js';
import { TEXT_PRESETS } from '../effects/presets.js';
import AlgoPanel from './AlgoPanel.jsx';
import PresetPanel from './PresetPanel.jsx';
import ShuffleButton from './ShuffleButton.jsx';
import ActiveChainList from './ActiveChainList.jsx';
import CopyRecipeButton from './CopyRecipeButton.jsx';
import { useCopyToClipboard } from './useCopyToClipboard.js';
import { renderTextPoster } from '../core/text-render.js';

const TEXT_EFFECTS = getEffectsFor('text');
const SAMPLE = 'Paste your own text, or start editing this sample to see how each effect distorts it.';

export default function TextTab({ seed, onReroll, initialRecipe, seedLocked, onSeedLockChange }) {
  const [input, setInput] = useState(SAMPLE);
  const [algos, setAlgos] = useState(initialRecipe?.a ?? ['homoglyph', 'scramble']);
  const [intensity, setIntensity] = useState(initialRecipe?.i ?? 0.4);
  const [effectParams, setEffectParams] = useState(initialRecipe?.p ?? {});
  const [preset, setPreset] = useState(null);
  const [showAdv, setShowAdv] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gleetch-favorites') || '[]'); } catch { return []; }
  });

  const output = useMemo(() => {
    const rng = prng(seed);
    return applyEffectChain(input, algos, { mediaType: 'text', intensity }, rng, effectParams);
  }, [input, algos, intensity, seed, effectParams]);

  const applyPreset = (k) => { const p = TEXT_PRESETS[k]; setAlgos(p.algos); setIntensity(p.intensity); setPreset(k); };
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
    setAlgos(randomEffectSelection('text', rng, { exclude: algos }));
    setIntensity(0.15 + rng() * 0.7);
    if (!seedLocked) onReroll();
  };

  const [copyOutput, outputCopied] = useCopyToClipboard();
  const [showPoster, setShowPoster] = useState(false);
  const [posterFont, setPosterFont] = useState('serif');
  const [posterSize, setPosterSize] = useState(48);
  const [posterColor, setPosterColor] = useState('#FFFFFF');
  const [posterBg, setPosterBg] = useState('#0A0A1C');
  const seedStr = String(seed).padStart(6, '0');

  const exportPoster = () => {
    const canvas = renderTextPoster({ text: output, W: 1080, H: 1920, font: posterFont, size: posterSize, color: posterColor, bg: posterBg });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `gleetch-poster-${String(seed).padStart(6, '0')}.png`;
    a.click();
  };

  return (
    <>
      <aside className="sidebar">
        <span className="lbl">PRESETS</span>
        <PresetPanel presets={TEXT_PRESETS} active={preset} onSelect={applyPreset} />
        <button className="adv-toggle" onClick={() => setShowAdv((v) => !v)}>{showAdv ? '▼' : '▶'} EFFECTS ({TEXT_EFFECTS.length})</button>
        {showAdv && <div className="algo-scroll"><AlgoPanel effects={TEXT_EFFECTS} active={algos} onToggle={toggleAlgo} favorites={favorites} onToggleFavorite={toggleFavorite} /></div>}
        <ActiveChainList algos={algos} mediaType="text" onReorder={setAlgos} onRemove={(id) => setAlgos((p) => p.filter((a) => a !== id))} effectParams={effectParams} onParamsChange={setEffectParams} />
        <div className="div" />
        <div className="sec">
          <span className="lbl">INTENSITY — {(intensity * 100).toFixed(0)}%</span>
          <input type="range" className="slider" min=".02" max="1" step=".01"
            value={intensity} onChange={(e) => { setPreset(null); setIntensity(parseFloat(e.target.value)); }} />
        </div>
        <div className="div" />
        <div className="seed-row"><span className="seed-lbl">SEED</span><span className="seed-val">#{seedStr}</span>
          <button className={`seed-lock-btn ${seedLocked ? 'locked' : ''}`} onClick={() => onSeedLockChange(!seedLocked)} title={seedLocked ? 'Unlock seed (shuffle will re-roll)' : 'Lock seed (shuffle keeps base pattern)'}>
            {seedLocked ? '🔒' : '🔓'}
          </button>
        </div>
        <button className="reroll-btn" onClick={onReroll}>⟳  RE-ROLL SEED</button>
        <ShuffleButton onClick={shuffle} />
        <button className="act-btn" onClick={() => copyOutput(output)} style={{ marginTop: 4 }}>{outputCopied ? '✓ COPIED' : '⎘ COPY OUTPUT'}</button>
        <div className="div" />
        <button className="adv-toggle" onClick={() => setShowPoster(!showPoster)}>{showPoster ? '▼' : '▶'} TEXT → IMAGE POSTER</button>
        {showPoster && (
          <>
            <div className="sec">
              <span className="lbl">FONT</span>
              <div className="fmt-row">
                {['serif', 'sans-serif', 'monospace'].map((f) => (
                  <button key={f} className={`fmt-btn ${posterFont === f ? 'on' : ''}`} onClick={() => setPosterFont(f)}>{f}</button>
                ))}
              </div>
            </div>
            <div className="sec">
              <span className="lbl">SIZE — {posterSize}px</span>
              <input type="range" className="slider" min="12" max="120" step="2" value={posterSize} onChange={(e) => setPosterSize(parseInt(e.target.value))} />
            </div>
            <div className="sec">
              <span className="lbl">COLORS</span>
              <div className="fmt-row">
                <input type="color" value={posterColor} onChange={(e) => setPosterColor(e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none' }} />
                <input type="color" value={posterBg} onChange={(e) => setPosterBg(e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none' }} />
              </div>
            </div>
            <button className="act-btn" onClick={exportPoster}>↓ EXPORT POSTER (1080×1920)</button>
          </>
        )}
        <CopyRecipeButton getRecipe={() => ({ t: 'text', s: seed, a: algos, i: intensity, p: effectParams })} />
      </aside>
      <main className="main" style={{ flexDirection: 'column' }}>
        <div className="text-areas">
          <div className="text-area-wrap">
            <span className="text-label">INPUT — paste text, code, writing, anything</span>
            <textarea className="text-input" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Paste text, code, poetry, prose, source files…" spellCheck={false} />
          </div>
          <div className="text-area-wrap">
            <span className="text-label">OUTPUT — glitched · {output.length} chars</span>
            <div className="text-output">{output || 'gleetch output appears here…'}</div>
          </div>
        </div>
      </main>
    </>
  );
}
