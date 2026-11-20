import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { fontOf, isRtl, layoutWords, wordsOf } from '../../lib/text';
import { verseRange } from '../../lib/sections';
import { fitSize, litUpTo } from './model';

/**
 * Full Verse — the whole verse at once, each word lighting up as it is sung,
 * with the text auto-fitted to the stage.
 */
export const fullVerse: LyricStyle = {
  id: 'full-verse',
  name: 'Full Verse',
  description: 'The whole verse on screen, lit one word at a time.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'Whole verse',
  isNew: true,
  usesIcons: false,
  gradient: ['#0c0a06', '#ffd479'],
  palette: {
    accent: '#ffd479',
    text: '#fff7e6',
    dim: 'rgba(255,247,230,0.22)',
    background: '#0c0a06',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#0c0a06';
    ctx.fillRect(0, 0, width, height);

    if (state.activeIndex < 0) {
      placeholder(ctx, state);
      return;
    }

    const [start, end] = verseRange(state.lines, state.activeIndex);
    const lines = state.lines
      .slice(start, end + 1)
      .filter((line) => line.text.trim() !== '');
    if (lines.length === 0) {
      placeholder(ctx, state);
      return;
    }

    // Lay every line out, then size to fit the block.
    const probe = Math.min(height * 0.06, width / 18);
    ctx.font = fontOf(probe, 600);
    const layouts = lines.map((line) => {
      const words = wordsOf(line);
      return {
        line,
        words,
        laid: layoutWords(words, (text) => ctx.measureText(text).width, probe * 0.3, width * 0.88, probe),
      };
    });

    const rows = layouts.reduce((sum, entry) => sum + entry.laid.rows.length, 0);
    const widest = Math.max(1, ...layouts.flatMap((entry) => entry.laid.rowWidths)) / probe;
    const size = fitSize(rows, widest, width, height);

    const lineGap = size * 0.55;
    const blockHeight = rows * size * 1.28 + lines.length * lineGap;
    let y = height / 2 - blockHeight / 2 + size;

    ctx.textBaseline = 'middle';

    for (const entry of layouts) {
      const activeLine = state.lines[state.activeIndex] === entry.line;
      const lit = litUpTo(entry.words, state.positionMs);
      const lineHeight = size * 1.28;

      entry.laid.rows.forEach((row, rowIndex) => {
        const rowWidth = (entry.laid.rowWidths[rowIndex] ?? 0) * (size / probe);
        let x = width / 2 - rowWidth / 2;
        for (const item of row) {
          const width_ = (item.width * size) / probe;
          const on = activeLine && item.wordIndex <= lit;
          const current = activeLine && item.wordIndex === Math.max(0, lit);
          ctx.font = fontOf(size, current ? 800 : 600);
          ctx.textAlign = isRtl(item.text) ? 'right' : 'left';
          ctx.fillStyle = current ? palette.accent : on ? palette.text : palette.dim;
          ctx.fillText(item.text, isRtl(item.text) ? x + width_ : x, y + rowIndex * lineHeight);
          x += width_ + size * 0.3;
        }
      });

      y += entry.laid.rows.length * lineHeight + lineGap;
    }
  },
};
