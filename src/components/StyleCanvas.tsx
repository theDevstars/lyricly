import { useEffect, useRef } from 'react';
import type { Snapshot } from '../types';
import type { LyricStyle, StyleState } from '../styles/types';
import { activeLineIndex, playbackPosition, wordAt } from '../lib/timing';
import { resolvePalette } from '../lib/colors';
import { reportFrameTime } from '../lib/api';

/// Light mode asks for 30 fps, so a frame is skipped when the last one is young.
const LIGHT_FRAME_MS = 32;

interface StyleCanvasProps {
  snapshot: Snapshot;
  style: LyricStyle;
  className?: string;
  /** Nothing to show: skip the work instead of painting invisible frames. */
  hidden?: boolean;
}

/** Runs the render loop for a style on a DPR-aware canvas. */
export function StyleCanvas({ snapshot, style, className, hidden }: StyleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef(snapshot);
  const styleRef = useRef(style);
  const hiddenRef = useRef(Boolean(hidden));
  const startedAt = useRef(performance.now());

  snapshotRef.current = snapshot;
  styleRef.current = style;
  hiddenRef.current = Boolean(hidden);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastDraw = 0;
    let lastReport = performance.now();

    const draw = () => {
      frame = requestAnimationFrame(draw);

      const canvas = canvasRef.current;
      if (!canvas || hiddenRef.current) return;

      const now = performance.now();
      const light = snapshotRef.current.qol?.lightMode;
      if (light && now - lastDraw < LIGHT_FRAME_MS) return;

      // One report a second is enough to notice a machine that cannot cope.
      if (now - lastReport > 1000) {
        if (snapshotRef.current.qol?.enabled) {
          void reportFrameTime(Math.round(now - lastDraw));
        }
        lastReport = now;
      }
      lastDraw = now;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      if (width < 2 || height < 2) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const snapshot = snapshotRef.current;
      const activeStyle = styleRef.current;
      const lines = snapshot.lyrics?.lines ?? [];
      const position = playbackPosition(snapshot) + 0;
      const index = activeLineIndex(lines, position);
      const line = index >= 0 ? lines[index] : null;
      const words = wordAt(line, position);

      const state: StyleState = {
        lines,
        activeIndex: index,
        lineProgress: words.lineProgress,
        wordIndex: words.wordIndex,
        wordProgress: words.wordProgress,
        positionMs: position,
        playing: snapshot.playback.status === 'playing',
        track: {
          title: snapshot.playback.title,
          artist: snapshot.playback.artist,
          app: snapshot.playback.app,
        },
        palette: resolvePalette(activeStyle.palette, snapshot.settings),
        time: performance.now() - startedAt.current,
        width,
        height,
      };

      ctx.save();
      activeStyle.render(ctx, state);
      ctx.restore();
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
