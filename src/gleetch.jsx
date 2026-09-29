import { useState, useEffect, useCallback, useRef } from 'react';
import { randomSeed } from './core/constants.js';
import { loadImageFile } from './core/canvas-utils.js';
import { getRecipeFromURL, clearRecipeFromURL } from './core/recipe.js';
import { QualityProvider, useQuality } from './core/quality.jsx';
import VisualTab from './components/VisualTab.jsx';
import TextTab from './components/TextTab.jsx';
import AudioTab from './components/AudioTab.jsx';
import VideoTab from './components/VideoTab.jsx';
import WebTab from './components/WebTab.jsx';
import SidebarResizer from './components/SidebarResizer.jsx';
import HelpPanel from './components/HelpPanel.jsx';
import logoUrl from './assets/logo.svg';

const TABS = [
  ['visual', '⬛ VISUAL'],
  ['text', '✦ TEXT'],
  ['audio', '◎ AUDIO'],
  ['video', '▶ VIDEO'],
  ['web', '◈ WEB'],
];

function AppInner() {
  const { cycleQuality, current, isBatterySaver } = useQuality();
  const [incomingRecipe] = useState(() => getRecipeFromURL());
  // A crafted ?recipe= URL can carry a t value that matches no tab — fall
  // back to 'visual' so a shared link never renders an empty page.
  const initialTab = TABS.some(([id]) => id === incomingRecipe?.t) ? incomingRecipe.t : 'visual';
  const [tab, setTab] = useState(initialTab);
  const [seed, setSeed] = useState(incomingRecipe?.s ?? randomSeed());
  const [iter, setIter] = useState(0);
  const [burst, setBurst] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [seedLocked, setSeedLocked] = useState(false);

  const [vMode, setVMode] = useState('generate');
  const [uploadedImg, setUploadedImg] = useState(null);

  const reroll = useCallback(() => {
    setBurst(true);
    setTimeout(() => setBurst(false), 500);
    setSeed(randomSeed());
    setIter((i) => i + 1);
  }, []);

  const rerollRef = useRef(reroll);
  useEffect(() => { rerollRef.current = reroll; }, [reroll]);

  useEffect(() => {
    const onPaste = async (e) => {
      // clipboardData is null in some browsers/contexts; getAsFile can also
      // return null — either must be a no-op, never a TypeError.
      const items = e.clipboardData?.items ?? [];
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const img = await loadImageFile(file);
          setUploadedImg(img);
          setVMode('upload');
          setTab('visual');
        } catch { /* undecodable paste — keep current content */ }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  useEffect(() => {
    if (incomingRecipe) clearRecipeFromURL();
  }, [incomingRecipe]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); rerollRef.current?.(); }
      if (e.code === 'ArrowRight') { e.preventDefault(); setSeed((s) => (s + 1) % 2147483647); setIter((i) => i + 1); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); setSeed((s) => (s - 1 + 2147483647) % 2147483647); setIter((i) => i + 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="root">
 <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logoUrl} alt="GLEETCH" className={`logo-img ${burst ? 'burst' : ''}`} width="168" height="28" style={{ display: 'block', height: 28, width: 'auto' }} />
          <div className="tagline" style={{ paddingBottom: 0 }}>a general special-effects library · images · text · audio · video · css · 120 patterns · infinite · 100+ effects</div>
        </div>
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`tab-btn ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="header-right">
          <button className="quality-btn" onClick={cycleQuality} title={`Quality: ${current.name} (click to cycle) — ${isBatterySaver ? 'BATTERY SAVER ACTIVE' : 'auto'}`}>
            ⚡ {current.name}
          </button>
          <button className="help-btn" onClick={() => setShowHelp(true)} aria-label="Help">?</button>
        </div>
      </header>

      {showHelp && <HelpPanel initialSection={tab} onClose={() => setShowHelp(false)} />}

      <div className="body">
        <SidebarResizer />
        {tab === 'visual' && (
          <VisualTab seed={seed} iter={iter} onReroll={reroll} mode={vMode} setMode={setVMode} uploadedImg={uploadedImg} setUploadedImg={setUploadedImg} initialRecipe={incomingRecipe?.t === 'visual' ? incomingRecipe : null} seedLocked={seedLocked} onSeedLockChange={setSeedLocked} />
        )}
        {tab === 'text' && <TextTab seed={seed} onReroll={reroll} initialRecipe={incomingRecipe?.t === 'text' ? incomingRecipe : null} seedLocked={seedLocked} onSeedLockChange={setSeedLocked} />}
        {tab === 'audio' && <AudioTab seed={seed} onReroll={reroll} initialRecipe={incomingRecipe?.t === 'audio' ? incomingRecipe : null} seedLocked={seedLocked} onSeedLockChange={setSeedLocked} />}
        {tab === 'video' && <VideoTab seed={seed} onReroll={reroll} initialRecipe={incomingRecipe?.t === 'video' ? incomingRecipe : null} seedLocked={seedLocked} onSeedLockChange={setSeedLocked} />}
        {tab === 'web' && <WebTab seed={seed} onReroll={reroll} initialRecipe={incomingRecipe?.t === 'web' ? incomingRecipe : null} seedLocked={seedLocked} onSeedLockChange={setSeedLocked} />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QualityProvider>
      <AppInner />
    </QualityProvider>
  );
}
