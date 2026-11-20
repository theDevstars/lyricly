import { useEffect, useRef, useState } from 'react';
import { DEMO_DURATION_MS } from './demoTrack';

export interface DemoPlayer {
  positionMs: number;
  playing: boolean;
  seek: (position: number) => void;
  toggle: () => void;
}

const TICK_MS = 50;

/** A tiny looping clock for the preview, independent of real playback. */
export function useDemoPlayer(enabled: boolean): DemoPlayer {
  const [positionMs, setPosition] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled || !playing) return;
    last.current = performance.now();

    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last.current;
      last.current = now;
      setPosition((position) => (position + delta) % DEMO_DURATION_MS);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [enabled, playing]);

  return {
    positionMs,
    playing,
    seek: (value) => setPosition(Math.max(0, Math.min(DEMO_DURATION_MS, value))),
    toggle: () => setPlaying((value) => !value),
  };
}
