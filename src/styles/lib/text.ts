import type { LyricLine, LyricWord } from '../../types';

export const FONT_STACK = '"Segoe UI", system-ui, sans-serif';

/**
 * The app and the marketing playground share these renderers. The playground
 * sets a temporary font/scale for its stage; the app leaves the defaults alone.
 */
let fontOverride: string | null = null;
let scaleOverride = 1;

export function setStyleTextOptions(options: { family?: string | null; scale?: number }): void {
  fontOverride = options.family?.trim() || null;
  scaleOverride = Math.min(1.8, Math.max(0.7, options.scale ?? 1));
}

const RTL_RANGE = /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0780-\u07bf]/;

/** True when the text starts with a right-to-left script. */
export const isRtl = (text: string): boolean => RTL_RANGE.test(text);

export const fontOf = (size: number, weight: number | string = 500, family = FONT_STACK): string =>
  `${weight} ${Math.max(6, Math.round(size * scaleOverride))}px ${fontOverride ?? family}`;

export const clamp = (value: number, low = 0, high = 1): number =>
  Math.min(high, Math.max(low, value));

export interface LaidWord {
  text: string;
  wordIndex: number;
  startMs: number;
  endMs: number;
  /** Offset from the row's left edge. */
  x: number;
  width: number;
}

export interface WordRows {
  size: number;
  rows: LaidWord[][];
  rowWidths: number[];
}

/**
 * Lays words into rows no wider than `maxWidth`. Measuring is injected so the
 * layout can be tested without a canvas.
 */
export function layoutWords(
  words: LyricWord[],
  measure: (text: string) => number,
  space: number,
  maxWidth: number,
  size: number,
): WordRows {
  const rows: LaidWord[][] = [];
  const rowWidths: number[] = [];
  let row: LaidWord[] = [];
  let cursor = 0;

  words.forEach((word, wordIndex) => {
    const text = word.text;
    const width = Math.max(4, measure(text));
    const gap = row.length > 0 ? space : 0;
    if (row.length > 0 && cursor + gap + width > maxWidth) {
      rows.push(row);
      rowWidths.push(cursor);
      row = [];
      cursor = 0;
    }
    const x = cursor + (row.length > 0 ? space : 0);
    row.push({
      text,
      wordIndex,
      startMs: word.startMs,
      endMs: word.endMs,
      x,
      width,
    });
    cursor = x + width;
  });

  if (row.length > 0) {
    rows.push(row);
    rowWidths.push(cursor);
  }

  return { size, rows, rowWidths };
}

/** Words for a line; a line parsed without word timing gets one word per token. */
export function wordsOf(line: LyricLine, fallbackSize = 220): LyricWord[] {
  if (line.words.length > 0) return line.words;
  const tokens = line.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(fallbackSize, line.endMs - line.startMs);
  const step = span / tokens.length;
  return tokens.map((text, index) => ({
    text,
    startMs: Math.round(line.startMs + index * step),
    endMs: Math.round(line.startMs + (index + 1) * step),
  }));
}

/** Text of a line, safely. */
export const lineText = (line: LyricLine | null | undefined): string => line?.text ?? '';

/** The line being sung, or null. */
export const activeLine = (lines: LyricLine[], activeIndex: number): LyricLine | null =>
  activeIndex >= 0 && activeIndex < lines.length ? lines[activeIndex] : null;

/** A short line to show when there is nothing to sing. */
export const idleText = (title: string): string => (title ? '♪' : 'Play a track to see lyrics');
