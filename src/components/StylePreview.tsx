import { useEffect, useRef } from 'react';
import type { LyricLine } from '../types';
import type { LyricStyle, StyleState } from '../styles/types';
import { activeLineIndex, wordAt } from '../lib/timing';

const LOOP_MS = 9000;

/** Three synthetic lines that loop forever, used only by gallery previews. */
const SAMPLE: { text: string; syllables: number[] }[] = [
  { text: 'the city hums in blue', syllables: [1, 2, 1, 1, 1] },
  { text: 'we fall through open sky', syllables: [1, 1, 1, 2, 1] },
  { text: 'hold the light a little longer', syllables: [1, 1, 1, 2, 1, 2, 2] },
];

function sampleLines(): LyricLine[] {
  const lines: LyricLine[] = [];
  let cursor = 300;

  SAMPLE.forEach((sample) => {
    const words = sample.text.split(' ');
    const duration = 2400;
    const weights = words.map((_, index) => sample.syllables[index] ?? 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    let wordCursor = cursor;
    const timed = words.map((word, index) => {
      const share = (weights[index] / total) * duration;
      const start = Math.round(wordCursor);
      const end = Math.round(wordCursor + share);
      wordCursor += share;
      return { text: word, startMs: start, endMs: end };
    });

    lines.push({
      startMs: cursor,
      endMs: cursor + duration,
      text: sample.text,
      words: timed,
      exact: false,
    });
    cursor += duration + 260;
  });

  return lines;
}

const LINES = sampleLines();
const TOTAL = LOOP_MS;

interface StylePreviewProps {
  style: LyricStyle;
}

export function StylePreview({ style }: StylePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const styleRef = useRef(style);
  styleRef.current = style;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const started = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      frame = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      if (width < 2 || height < 2) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const elapsed = performance.now() - started;
      const position = (elapsed % TOTAL) + 300;
      const activeStyle = styleRef.current;
      const index = activeLineIndex(LINES, position);
      const line = index >= 0 ? LINES[index] : null;
      const words = wordAt(line, position);

      const state: StyleState = {
        lines: LINES,
        activeIndex: index,
        lineProgress: words.lineProgress,
        wordIndex: words.wordIndex,
        wordProgress: words.wordProgress,
        positionMs: position,
        playing: true,
        track: { title: 'Tiny Dancer', artist: 'Elton John', app: 'Spotify' },
        palette: activeStyle.palette,
        time: elapsed,
        width,
        height,
      };

      ctx.save();
      activeStyle.render(ctx, state);
      ctx.restore();
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="preview-canvas" />;
}
