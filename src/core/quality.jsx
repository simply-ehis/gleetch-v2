import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const QualityContext = createContext(null);

const QUALITY_TIERS = {
  low: {
    name: 'LOW',
    maxCanvasDim: 256,
    videoMaxDim: 320,
    targetFPS: 15,
    heavyEffectThrottle: 8,
    waveformSteps: 4,
    audioQuality: 0.5,
    enableHeavyEffects: false,
    enableParticles: false,
    enableWebGlitch: false,
    maxLayers: 1,
    maxCustomDim: 1024,
  },
  medium: {
    name: 'MEDIUM',
    maxCanvasDim: 384,
    videoMaxDim: 480,
    targetFPS: 30,
    heavyEffectThrottle: 4,
    waveformSteps: 2,
    audioQuality: 0.75,
    enableHeavyEffects: true,
    enableParticles: true,
    enableWebGlitch: true,
    maxLayers: 2,
    maxCustomDim: 1536,
  },
  high: {
    name: 'HIGH',
    maxCanvasDim: 512,
    videoMaxDim: 720,
    targetFPS: 60,
    heavyEffectThrottle: 1,
    waveformSteps: 1,
    audioQuality: 1,
    enableHeavyEffects: true,
    enableParticles: true,
    enableWebGlitch: true,
    maxLayers: 3,
    maxCustomDim: 2048,
  },
};

export function QualityProvider({ children }) {
  const [quality, setQuality] = useState(() => {
    if (typeof window !== 'undefined') {
      // Storage can throw (private mode, disabled cookies, sandboxed
      // iframe) — a settings read must never crash the whole app.
      try {
        const stored = localStorage.getItem('gleetch-quality');
        if (stored && QUALITY_TIERS[stored]) return stored;
      } catch { /* fall through to hardware detection */ }
      const cores = navigator.hardwareConcurrency || 4;
      const mem = navigator.deviceMemory;
      if (mem !== undefined) {
        if (cores <= 4 || mem <= 4) return 'low';
        if (cores <= 8 || mem <= 8) return 'medium';
        return 'high';
      }
      if (cores <= 4) return 'low';
      if (cores <= 8) return 'medium';
      return 'high';
    }
    return 'medium';
  });

  const [isBatterySaver, setIsBatterySaver] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('gleetch-quality', quality); } catch { /* storage unavailable — preference just won't persist */ }
  }, [quality]);

  // Battery saver detection
  useEffect(() => {
    if (!('getBattery' in navigator)) return;
    let cancelled = false;
    navigator.getBattery().then((battery) => {
      const check = () => {
        if (cancelled) return;
        const saver = battery.charging === false && battery.level < 0.3;
        setIsBatterySaver(saver);
      };
      check();
      battery.addEventListener('levelchange', check);
      battery.addEventListener('chargingchange', check);
      return () => {
        cancelled = true;
        battery.removeEventListener('levelchange', check);
        battery.removeEventListener('chargingchange', check);
      };
    }).catch(() => { /* Battery API unavailable or denied — stay on the stored tier */ });
  }, []);

  // Battery saver forces the low tier while it's active, WITHOUT writing
  // the override into the stored preference — derived here so the user's
  // own choice returns the moment the saver ends. Deriving instead of
  // setState-in-effect also avoids a cascading render on every toggle.
  const effectiveQuality = isBatterySaver ? 'low' : quality;

  const cycleQuality = useCallback(() => {
    const tiers = ['low', 'medium', 'high'];
    const idx = tiers.indexOf(quality);
    setQuality(tiers[(idx + 1) % tiers.length]);
  }, [quality]);

  const current = QUALITY_TIERS[effectiveQuality];

  return (
    <QualityContext.Provider value={{ quality: effectiveQuality, setQuality, cycleQuality, current, isBatterySaver }}>
      {children}
    </QualityContext.Provider>
  );
}

export function useQuality() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error('useQuality must be used within QualityProvider');
  return ctx;
}