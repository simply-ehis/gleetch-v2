import { getEffectById } from '../effects/registry.js';

// Renders controls for one effect's `params` schema (see registry.js /
// STYLIZE_EFFECTS' asciiShapes entry for the shape of that schema) —
// generic, driven entirely by what the effect declares, not hardcoded to
// any single effect. `showWhen` lets one param only appear when another
// param currently equals a given value (e.g. the color swatch only when
// colorMode is 'single').
function ParamControls({ effect, values, onChange }) {
  return (
    <div className="chain-params">
      {effect.params.map((p) => {
        if (p.showWhen) {
          const [depKey, depVal] = Object.entries(p.showWhen)[0];
          const depDefault = effect.params.find((x) => x.key === depKey)?.default;
          if ((values[depKey] ?? depDefault) !== depVal) return null;
        }
        const current = values[p.key] ?? p.default;
        if (p.type === 'select') {
          return (
            <label key={p.key} className="chain-param">
              <span>{p.label}</span>
              <select value={current} onChange={(e) => onChange({ ...values, [p.key]: e.target.value })}>
                {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        }
        if (p.type === 'color') {
          return (
            <label key={p.key} className="chain-param">
              <span>{p.label}</span>
              <input type="color" value={current} onChange={(e) => onChange({ ...values, [p.key]: e.target.value })} />
            </label>
          );
        }
        if (p.type === 'range') {
          return (
            <label key={p.key} className="chain-param">
              <span>{p.label}</span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step ?? 1}
                value={current}
                onChange={(e) => onChange({ ...values, [p.key]: Number(e.target.value) })}
              />
              <span className="chain-param-val">{current}</span>
            </label>
          );
        }
        return null;
      })}
    </div>
  );
}

// Shows the currently-active effects in execution order with ▲▼ to
// reorder and ✕ to remove. applyEffectChain/applyVideoEffectChain already
// run effects in array order — this is purely a UI to let the user control
// that order directly, instead of the only previous option (deselect +
// reselect in the desired sequence, which is clumsy and easy to get wrong).
//
// effectParams/onParamsChange are optional — a tab that omits both simply
// renders no per-effect controls. Every tab wires them today.
export default function ActiveChainList({ algos, mediaType, onReorder, onRemove, effectParams = {}, onParamsChange }) {
  if (!algos.length) return null;

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= algos.length) return;
    const next = [...algos];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };

  return (
    <div className="chain-list">
      <span className="lbl">ACTIVE CHAIN — order matters</span>
      {algos.map((id, i) => {
        const effect = getEffectById(id, mediaType);
        return (
          <div key={id} className="chain-item-wrap">
            <div className="chain-item">
              <span className="chain-order">{i + 1}</span>
              <span className="chain-name">{effect?.label ?? id}</span>
              <button className="chain-btn" onClick={() => move(i, -1)} disabled={i === 0} title="Move earlier in the chain">▲</button>
              <button className="chain-btn" onClick={() => move(i, 1)} disabled={i === algos.length - 1} title="Move later in the chain">▼</button>
              <button className="chain-btn" onClick={() => onRemove(id)} title="Remove from chain">✕</button>
            </div>
            {effect?.params && onParamsChange && (
              <ParamControls
                effect={effect}
                values={effectParams[id] ?? {}}
                onChange={(next) => onParamsChange({ ...effectParams, [id]: next })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
