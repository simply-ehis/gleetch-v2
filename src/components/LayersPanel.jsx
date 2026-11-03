import { useState } from 'react';

// Collapsible three-layer panel: Base / Effects / Colour.
// Shows what the last shuffle picked and lets the user tweak each layer.
export default function LayersPanel({ seed, algos, onAlgosChange, intensity, onIntensityChange,
  colourPasses, onColourPassesChange, collapsed, onToggleCollapsed, layerRecipe, onBaseReroll, baseFamily, onBaseFamilyChange }) {
  const [openBase, setOpenBase] = useState(!collapsed);
  const [openEffects, setOpenEffects] = useState(!collapsed);
  const [openColour, setOpenColour] = useState(!collapsed);

  const baseName = layerRecipe?.base?.recipe?.name ?? '—';
  const baseFamilyLabel = layerRecipe?.family ?? baseFamily ?? 'beauty';

  return (
    <div className="layers-panel">
      {/* Base (Layer 1) */}
      <section className="layer-section">
        <button className="layer-header" onClick={() => setOpenBase((v) => !v)}>
          {openBase ? '▼' : '▶'} BASE
        </button>
        {openBase && (
          <div className="layer-body">
            <div className="base-info">
              <span className="base-lbl">{baseFamilyLabel.charAt(0).toUpperCase() + baseFamilyLabel.slice(1)}</span>
              <span className="base-name">{baseName}</span>
            </div>
            {baseFamily !== undefined && (
              <div className="fmt-row" style={{ marginTop: 6 }}>
                {['beauty','illusions','patterns','art','effects'].map((id) => (
                  <button key={id} className={`fmt-btn ${baseFamily === id ? 'on' : ''}`} onClick={() => onBaseFamilyChange(id)}>{id.charAt(0).toUpperCase() + id.slice(1)}</button>
                ))}
              </div>
            )}
            <button className="act-btn" style={{ width: '100%', marginTop: 6, fontSize: 11 }} onClick={onBaseReroll}>⟳ NEW BASE</button>
          </div>
        )}
      </section>

      {/* Effects (Layer 2) */}
      <section className="layer-section">
        <button className="layer-header" onClick={() => setOpenEffects((v) => !v)}>
          {openEffects ? '▼' : '▶'} EFFECTS ({algos.length})
        </button>
        {openEffects && (
          <div className="layer-body">
            <div className="effect-chips">
              {algos.map((id) => (
                <span key={id} className="chip">
                  {id}
                  <button onClick={() => onAlgosChange(algos.filter((x) => x !== id))}>×</button>
                </span>
              ))}
              {algos.length === 0 && <span className="sidebar-hint" style={{ fontSize: 10, color: '#8a8f98' }}>none</span>}
            </div>
          </div>
        )}
      </section>

      {/* Colour / Layer 3 */}
      <section className="layer-section">
        <button className="layer-header" onClick={() => setOpenColour((v) => !v)}>
          {openColour ? '▼' : '▶'} COLOUR ({colourPasses.length})
        </button>
        {openColour && (
          <div className="layer-body">
            {colourPasses.map((pass, idx) => (
              <div key={idx} className="colour-pass">
                <select value={pass.method} onChange={(e) => {
                  const next = [...colourPasses];
                  next[idx] = { ...pass, method: e.target.value };
                  onColourPassesChange(next);
                }}>
                  <option value="none">none</option>
                  <option value="hueShift">hue shift</option>
                  <option value="tint">tint</option>
                  <option value="paletteRemap">palette remap</option>
                  <option value="paintPass">paint pass</option>
                </select>
                <input type="range" min={0} max={1} step={0.01} value={pass.weight ?? 1}
                  onChange={(e) => {
                    const next = [...colourPasses];
                    next[idx] = { ...pass, weight: parseFloat(e.target.value) };
                    onColourPassesChange(next);
                  }} />
                <button onClick={() => onColourPassesChange(colourPasses.filter((_, i) => i !== idx))}>×</button>
              </div>
            ))}
            {colourPasses.length < 3 && (
              <button className="act-btn" style={{ width: '100%', marginTop: 6, fontSize: 11 }} onClick={() => onColourPassesChange([...colourPasses, { method: 'tint', weight: 1 }])}>
                + add colour pass
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
