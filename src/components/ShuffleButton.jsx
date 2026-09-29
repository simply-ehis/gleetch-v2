// Distinct from the RE-ROLL button (which only changes the seed): SHUFFLE
// randomizes which effects are active and their intensity, giving a fresh
// combination rather than the same chain with new noise.
export default function ShuffleButton({ onClick, disabled = false, label = 'SHUFFLE EFFECTS', onTogglePin }) {
  return (
    <div className="shuffle-row">
      <button className="shuffle-btn" onClick={onClick} disabled={disabled}>
        🎲 {label}
      </button>
      {onTogglePin && (
        <button className="pin-btn" onClick={() => onTogglePin()} disabled={disabled} title="Pin an effect to keep it in the chain while shuffling the rest">
          📌
        </button>
      )}
    </div>
  );
}
