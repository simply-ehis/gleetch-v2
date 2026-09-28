import { useState } from 'react';
import { prng, seedFromString } from '../core/rng.js';
import { fontShuffle } from '../effects/text/typography.js';

function displayLabel(effect) {
  if (effect.category !== 'typography') return effect.label;
  return fontShuffle(effect.label, 0.8, prng(seedFromString(effect.label)));
}

export default function AlgoPanel({ effects, active, onToggle, showHints = true, favorites = [], onToggleFavorite }) {
  const [collapsed, setCollapsed] = useState({});
  const categories = [];
  const byCategory = {};
  for (const e of effects) {
    if (!byCategory[e.category]) { byCategory[e.category] = []; categories.push(e.category); }
    byCategory[e.category].push(e);
  }

  const toggleCollapse = (cat) => setCollapsed((p) => ({ ...p, [cat]: !p[cat] }));

  return (
    <>
      {categories.map((cat) => (
        <div key={cat}>
          <div className="algo-cat-lbl" onClick={() => toggleCollapse(cat)} style={{ cursor: 'pointer', userSelect: 'none' }}>
            {collapsed[cat] ? '▶' : '▼'} {cat.replace('-', ' ')} ({byCategory[cat].length})
          </div>
          {!collapsed[cat] && byCategory[cat].map((a) => (
            <button
              key={a.id}
              className={`algo-btn cat-${a.category} ${active.includes(a.id) ? 'on' : ''}`}
              onClick={() => onToggle(a.id)}
            >
              <span className="adot" />{displayLabel(a)}
              {showHints && <span className="ahint">{a.hint}</span>}
              {onToggleFavorite && (
                <span
                  className={`fav-star ${favorites.includes(a.id) ? 'faved' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(a.id); }}
                >
                  {favorites.includes(a.id) ? '★' : '☆'}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
