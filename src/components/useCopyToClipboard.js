import { useState, useCallback, useRef, useEffect } from 'react';

// Every copy-to-clipboard button in the app previously gave zero visual
// confirmation that the copy succeeded — the button just did nothing
// visible. Found during a BUILD_CHECKLIST.md audit pass ("Success states
// implemented" is a real, explicit requirement). Returns [copy, justCopied]
// so a button can flip its own label briefly (e.g. "✓ COPIED") rather than
// introducing a separate toast/snackbar system — consistent with the
// existing pattern of state living in the control itself (see ScrambleText
// for the same philosophy applied to busy states).
export function useCopyToClipboard(resetMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  const flagCopied = useCallback(() => {
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), resetMs);
  }, [resetMs]);

  const copy = useCallback((text) => {
    // navigator.clipboard is undefined on insecure contexts (plain http://
    // on LAN, some webviews) — property access alone would throw. Fall back
    // to the legacy execCommand path so COPY buttons still work there.
    const modern = navigator.clipboard?.writeText;
    if (modern) {
      modern.call(navigator.clipboard, text).then(flagCopied).catch(() => {});
      return;
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      if (document.execCommand('copy')) flagCopied();
      document.body.removeChild(ta);
    } catch { /* clipboard unavailable — button just won't flip */ }
  }, [flagCopied]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return [copy, copied];
}
