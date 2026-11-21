import type { LyricStyle } from '../../types';
import { activeLine, fontOf, isRtl, layoutWords, wordsOf } from '../../lib/text';
import { carriageOffset, strikeJitter, typed } from './model';

const PAPER = '#efe7d2';

/**
 * Typewriter — lines are typed onto paper key by key, with a carriage return and
 * a little strike jitter. Ribbon ink takes the accent colour.
 */
export const typewriter: LyricStyle = {
  id: 'typewriter',
  name: 'Typewriter',
  description: 'Lines typed out on paper, key by key.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Type',
  isNew: true,
  usesIcons: false,
  gradient: ['#2a2418', '#e8dcc0'],
  palette: {
    accent: '#2b3a67',
    text: '#22201a',
    dim: 'rgba(34,32,26,0.35)',
    background: '#efe7d2',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);

    // Paper texture: a few faint fibres, deterministic.
    ctx.strokeStyle = 'rgba(80,66,40,0.05)';
    for (let line = 0; line < 26; line += 1) {
      const y = ((line * 997) % 1000) / 1000 * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + Math.sin(line) * 0.6);
      ctx.stroke();
    }

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      ctx.fillStyle = 'rgba(34,32,26,0.4)';
      ctx.font = fontOf(Math.min(22, width / 34), 500, '"Courier New", monospace');
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? '♪' : 'Play a track to see lyrics', width / 2, height / 2);
      return;
    }

    const words = wordsOf(line);
    let size = Math.min(height * 0.1, width / 12);
    // Measure with the size the words will actually be drawn at, or a large
    // canvas lays them out as if they were tiny and the glyphs overlap.
    ctx.font = `600 ${size}px "Courier New", monospace`;
    let laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.6, width * 0.78, size);
    for (let attempt = 0; attempt < 6 && laid.rows.length > 3; attempt += 1) {
      size *= 0.84;
      ctx.font = `600 ${size}px "Courier New", monospace`;
      laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.6, width * 0.78, size);
    }

    ctx.fillStyle = palette.accent;
    ctx.textBaseline = 'middle';
    const lineHeight = size * 1.7;
    const top = height / 2 - (laid.rows.length * lineHeight) / 2 + lineHeight / 2;
    const totalChars = line.text.length || 1;
    const typedChars = typed(line.text, state.lineProgress);

    let seen = 0;
    laid.rows.forEach((row, rowIndex) => {
      const rowWidth = laid.rowWidths[rowIndex] ?? 0;
      const origin = width / 2 - rowWidth / 2 - carriageOffset(state.lineProgress, width);
      const y = top + rowIndex * lineHeight;
      let x = origin;
      for (const item of row) {
        const chars = Math.max(0, Math.min(item.text.length, typedChars - seen));
        const shown = item.text.slice(0, chars);
        if (shown) {
          ctx.font = `600 ${size}px "Courier New", monospace`;
          ctx.textAlign = isRtl(shown) ? 'right' : 'left';
          ctx.fillText(shown, x + (isRtl(shown) ? item.width : 0), y + strikeJitter(seen));
        }
        // The type head, only while this line is still being typed.
        if (chars < item.text.length && seen + chars >= typedChars - 1) {
          ctx.fillRect(x + (cmdWidth(ctx) || 0), y - size * 0.42, size * 0.42, size * 0.9);
        }
        seen += item.text.length;
        x += item.width + size * 0.6;
      }
      seen += 0; // rows are contiguous; the counter carries the character budget.
    });

    // Baseline rule under the page, and the character count.
    ctx.fillStyle = 'rgba(43,58,103,0.16)';
    ctx.fillRect(width * 0.1, top + lineHeight * LaidBaseline(laid.rows.length), width * 0.8, 1);
    ctx.fillStyle = 'rgba(34,32,26,0.4)';
    ctx.font = '500 12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${typedChars}/${totalChars}`, width * 0.9, height * 0.9);
  },
};

const LaidBaseline = (rows: number): number => Math.max(0.5, rows - 0.5);

/** Width of the caret, used to place the type head after partial words. */
const cmdWidth = (ctx: CanvasRenderingContext2D): number => Math.max(0, ctx.measureText(' ').width);
