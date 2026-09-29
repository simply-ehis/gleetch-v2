import { useState, useRef, useEffect, useCallback } from 'react';

// Most browsers' decodeAudioData can pull the audio track directly out of
// an mp4/webm container (same API AudioTab already uses for standalone
// audio files) — no separate demuxing step needed. Fails quietly if the
// video has no audio track or an unsupported codec: video-only still works.
export function useVideoAudioTrack() {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioAlgos, setAudioAlgos] = useState(['bitCrush', 'stutter']);
  const [audioIntensity, setAudioIntensity] = useState(0.5);
  const [audioEffectParams, setAudioEffectParams] = useState({});
  const [decoding, setDecoding] = useState(false);
  const audioCtxRef = useRef(null);
  const loadGenRef = useRef(0);

  const extract = useCallback(async (file) => {
    setAudioBuffer(null);
    setDecoding(true);
    // Generation guard (same race as AudioTab.loadAudio): a second video
    // loaded while this decode is in flight must win.
    const gen = ++loadGenRef.current;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext();
      const decoded = await audioCtxRef.current.decodeAudioData(await file.arrayBuffer());
      if (gen === loadGenRef.current) setAudioBuffer(decoded);
    } catch {
      if (gen === loadGenRef.current) setAudioBuffer(null);
    }
    if (gen === loadGenRef.current) setDecoding(false);
  }, []);

  // Same AudioContext-exhaustion risk as AudioTab if this isn't closed on
  // unmount — see the pre-deploy audit for why this matters.
  useEffect(() => () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(() => {});
  }, []);

  return { audioBuffer, hasAudio: !!audioBuffer, decoding, extract, audioAlgos, setAudioAlgos, audioIntensity, setAudioIntensity, audioEffectParams, setAudioEffectParams, audioCtxRef };
}
