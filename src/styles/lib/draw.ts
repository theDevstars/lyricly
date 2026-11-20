import type { LyricWord } from '../../types';
import type { StyleState } from '../types';
import { activeLine, fontOf, isRtl, layoutWords, wordsOf, type LaidWord } from './text';

export const rrect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

export const backdrop = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  top: string,
  bottom: string,
): void => {
  const paint = ctx.createLinearGradient(0, 0, 0, height);
  paint.addColorStop(0, top);
  paint.addColorStop(1, bottom);
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, width, height);
};

export const placeholder = (ctx: CanvasRenderingContext2D, state: StyleState, text?: string): void => {
  ctx.fillStyle = state.palette.dim;
  ctx.font = fontOf(Math.min(22, Math.max(14, state.width / 34)), 500);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    text ?? (state.track.title ? '♪' : 'Play a track to see lyrics'),
    state.width / 2,
    state.height / 2,
  );
};

export interface LineLayout {
  line: ReturnType<typeof activeLine>;
  words: LyricWord[];
  size: number;
  rows: LaidWord[][];
  rowWidths: number[];
  rtl: boolean;
}

/**
 * Lays the active line out at a size that fits the stage. One call site so every
 * style wraps and shrinks the same way, including 40-word and CJK lines.
 */
export function layoutActive(
  ctx: CanvasRenderingContext2D,
  state: StyleState,
  options: { size?: number; maxWidthRatio?: number; maxRows?: number; weight?: number } = {},
): LineLayout | null {
  const line = activeLine(state.lines, state.activeIndex);
  if (!line) return null;

  const rtl = isRtl(line.text);
  const maxWidth = state.width * (options.maxWidthRatio ?? 0.86);
  const words = wordsOf(line);
  let size = options.size ?? Math.min(state.height * 0.14, state.width / 9);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    ctx.font = fontOf(size, options.weight ?? 600);
    const measured = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.28, maxWidth, size);
    const rows = options.maxRows ? Math.max(1, options.maxRows) : measured.rows.length;
    if (measured.rows.length <= rows || size < 12) {
      return { line, words, size, rows: measured.rows, rowWidths: measured.rowWidths, rtl };
    }
    size *= 0.82;
  }

  return null;
}

export interface RowPaint {
  x: number;
  y: number;
  row: LaidWord[];
  rowWidth: number;
  size: number;
  rtl: boolean;
}

/** Positions each row, centred, and hands it to the caller to paint words. */
export function paintRows(
  state: StyleState,
  layout: LineLayout,
  options: { lineHeight?: number; top?: number; centerY?: boolean } = {},
  paint: (row: RowPaint) => void,
): void {
  const lineHeight = options.lineHeight ?? layout.size * 1.18;
  const total = layout.rows.length * lineHeight;
  const startY =
    options.top ?? (options.centerY === false ? 0 : state.height / 2 - total / 2 + lineHeight / 2);

  layout.rows.forEach((row, index) => {
    const rowWidth = layout.rowWidths[index] ?? 0;
    paint({
      x: state.width / 2 - rowWidth / 2,
      y: startY + index * lineHeight,
      row,
      rowWidth,
      size: layout.size,
      rtl: layout.rtl,
    });
  });
}

/** Draws a word with a colour, honouring RTL by anchoring to the right edge. */
export function word(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, align === 'right' ? x : x, y);
}

/** Glow shortcut: draws with a coloured shadow, then restores state. */
export function withGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  paint: () => void,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  paint();
  ctx.restore();
}

/** How far a word has been sung, 0..1. */
export function sung(status: StyleState, startMs: number, endMs: number): number {
  const span = Math.max(1, endMs - startMs);
  return Math.min(1, Math.max(0, (status.positionMs - startMs) / span));
}

/** Word index on the active line, or -1. */
export const activeWordIndex = (state: StyleState): number => state.wordIndex;
