import { useState, useRef } from 'react';

export default function UploadZone({ label, subLabel, loaded, onFile, accept = 'image/*' }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);

  return (
    <div
      className={`upload-zone ${drag ? 'drag-over' : ''} ${loaded ? 'has-content' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current.click()}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => {
        // Clear the input so picking the SAME file twice still fires change
        // (otherwise re-uploading an identical file silently does nothing).
        const f = e.target.files[0];
        e.target.value = '';
        if (f) onFile(f);
      }} />
      <div className="uz-icon">{loaded ? '✓' : '↑'}</div>
      <div className="uz-text">{loaded ? label + ' LOADED' : label}</div>
      <div className="uz-sub">{subLabel}</div>
    </div>
  );
}
