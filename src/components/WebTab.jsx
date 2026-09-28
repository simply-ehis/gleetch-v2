import { useState, useMemo } from 'react';
import { prng } from '../core/rng.js';
import { randomSeed } from '../core/constants.js';
import { getEffectsFor, buildWebCSS, randomEffectSelection } from '../effects/registry.js';
import { WEB_PRESETS } from '../effects/presets.js';
import AlgoPanel from './AlgoPanel.jsx';
import PresetPanel from './PresetPanel.jsx';
import ShuffleButton from './ShuffleButton.jsx';
import ActiveChainList from './ActiveChainList.jsx';
import CopyRecipeButton from './CopyRecipeButton.jsx';
import { useCopyToClipboard } from './useCopyToClipboard.js';

const WEB_EFFECTS_LIST = getEffectsFor('web');

function buildBookmarklet(css) {
  const js = `(function(){var old=document.getElementById('gleetch-injected');if(old)old.remove();var s=document.createElement('style');s.id='gleetch-injected';s.textContent=${JSON.stringify(css)};document.head.appendChild(s);document.body.classList.add('gleetch-fx');})();`;
  return `javascript:${encodeURIComponent(js)}`;
}

// Same injection logic as buildBookmarklet, but delivered as plain,
// readable, multi-line JS meant for pasting straight into the browser's
// DevTools console — no javascript: URI, no bookmarks bar involved, works
// identically on every platform including ones with no accessible
// add/drag-to-bookmark flow. This is the primary "apply gleetch live to a
// page you don't own" path now; the bookmarklet is left as-is for anyone
// whose setup still supports it.
//
// Both functions remove any existing #gleetch-injected tag before adding
// a new one (running either twice used to stack duplicate <style> tags
// sharing the same id, invalid HTML, compounding the effect) and the
// printed undo command now removes the tag itself, not just the class —
// "remove it" previously only disabled the effect, the CSS stayed in the
// page forever.
function buildConsoleSnippet(css) {
  return `(function () {
  const old = document.getElementById('gleetch-injected');
  if (old) old.remove();
  const style = document.createElement('style');
  style.id = 'gleetch-injected';
  style.textContent = ${JSON.stringify(css)};
  document.head.appendChild(style);
  document.body.classList.add('gleetch-fx');
  console.log('%cgleetch applied — run this to remove it:\\ndocument.getElementById("gleetch-injected")?.remove();document.body.classList.remove("gleetch-fx")', 'color:#FF2D6B;font-weight:bold;');
})();`;
}

export default function WebTab({ seed, onReroll, initialRecipe, seedLocked, onSeedLockChange }) {
  const [algos, setAlgos] = useState(initialRecipe?.a ?? ['cssScanlines', 'cssRgbSplit']);
  const [intensity, setIntensity] = useState(initialRecipe?.i ?? 0.5);
  const [effectParams, setEffectParams] = useState(initialRecipe?.p ?? {});
  const [preset, setPreset] = useState(null);
  const [showAdv, setShowAdv] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gleetch-favorites') || '[]'); } catch { return []; }
  });
  const [importedCss, setImportedCss] = useState('');
  const [showImport, setShowImport] = useState(false);

  const generatedCss = useMemo(() => buildWebCSS(algos, intensity, prng(seed), effectParams), [algos, intensity, seed, effectParams]);
  const fullCss = importedCss ? `${importedCss}\n${generatedCss}` : generatedCss;

  const applyPreset = (k) => { const p = WEB_PRESETS[k]; setAlgos(p.algos); setIntensity(p.intensity); setPreset(k); };
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
    setAlgos(randomEffectSelection('web', rng, { exclude: algos }));
    setIntensity(0.3 + rng() * 0.6);
    if (!seedLocked) onReroll();
  };

  const downloadCss = () => {
    const blob = new Blob([fullCss], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gleetch-${String(seed).padStart(6, '0')}.css`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [copySnippet, snippetCopied] = useCopyToClipboard();
  const [copyBookmarklet, bookmarkletCopied] = useCopyToClipboard();
  const [copyConsole, consoleCopied] = useCopyToClipboard();
  const copyHtmlSnippet = () => copySnippet(`<style>\n${fullCss}\n</style>\n<!-- add class="gleetch-fx" to the element you want glitched -->`);
  const copyBookmarkletUrl = () => copyBookmarklet(buildBookmarklet(fullCss));
  const copyConsoleSnippet = () => copyConsole(buildConsoleSnippet(fullCss));

  const seedStr = String(seed).padStart(6, '0');

  return (
    <>
      <aside className="sidebar">
        <span className="lbl">PRESETS</span>
        <PresetPanel presets={WEB_PRESETS} active={preset} onSelect={applyPreset} />
        <button className="adv-toggle" onClick={() => setShowAdv((v) => !v)}>{showAdv ? '▼' : '▶'} EFFECTS ({WEB_EFFECTS_LIST.length})</button>
        {showAdv && <div className="algo-scroll"><AlgoPanel effects={WEB_EFFECTS_LIST} active={algos} onToggle={toggleAlgo} favorites={favorites} onToggleFavorite={toggleFavorite} /></div>}
        <ActiveChainList algos={algos} mediaType="web" onReorder={setAlgos} onRemove={(id) => setAlgos((p) => p.filter((a) => a !== id))} effectParams={effectParams} onParamsChange={setEffectParams} />
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
        <button className="reroll-btn" onClick={onReroll}>⟳  RE-ROLL</button>
        <ShuffleButton onClick={shuffle} />
        <CopyRecipeButton getRecipe={() => ({ t: 'web', s: seed, a: algos, i: intensity, p: effectParams })} />
        <div className="div" />
        <button className="adv-toggle" onClick={() => setShowImport((v) => !v)}>{showImport ? '▼' : '▶'} IMPORT YOUR CSS</button>
        {showImport && (
          <>
            <textarea className="web-import" value={importedCss} onChange={(e) => setImportedCss(e.target.value)}
              placeholder=".gleetch-demo { background: rgba(255,255,255,.08); backdrop-filter: blur(12px); border-radius: 16px; }" spellCheck={false} />
            <div className="sidebar-hint">restyles the demo card, not the effects — target .gleetch-demo (card), .gleetch-demo-heading (h2), .gleetch-demo-btn (button)</div>
          </>
        )}
      </aside>
      <main className="main" style={{ flexDirection: 'column' }}>
        <style>{fullCss}</style>
        <div className="web-preview">
          <div className="gleetch-fx web-demo-card gleetch-demo">
            <div className="web-demo-badge">DEMO</div>
            <h2 className="gleetch-demo-heading">Signal Corrupted</h2>
            <p>This is a live preview — every effect you toggle is real CSS, applied to this card right now. Export it and it works exactly the same on any site.</p>
            <button className="web-demo-btn gleetch-demo-btn">Click Me</button>
          </div>
        </div>
        <div className="web-export-row">
          <button className="act-btn" onClick={downloadCss}>↓ CSS FILE</button>
          <button className="act-btn" onClick={copyHtmlSnippet}>{snippetCopied ? '✓ COPIED' : '⎘ <style> SNIPPET'}</button>
          <button className="export-btn" onClick={copyConsoleSnippet}>{consoleCopied ? '✓ COPIED' : '⎘ DEV CONSOLE'}</button>
          <button className="act-btn" onClick={copyBookmarkletUrl}>{bookmarkletCopied ? '✓ COPIED' : '⎘ BOOKMARKLET'}</button>
        </div>
        <div className="canvas-hint">dev console: paste into any site's DevTools console (right-click → Inspect → Console, or F12) and hit enter — applies live, works everywhere · bookmarklet: legacy option, needs a browser that still supports add/drag-to-bookmark · CSS can't reach cross-origin pages directly, this is the workaround either way</div>
      </main>
    </>
  );
}
