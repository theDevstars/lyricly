import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { panesFor, wallRows } from './model';

/**
 * Dual Screen Split — big single-line type in one pane and the scrolling wall in
 * the other. On a monitor that has its own profile this pairs with a second
 * display running the other pane; on one screen it splits in two.
 */
export const dualScreenSplit: LyricStyle = {
  id: 'dual-screen-split',
  name: 'Dual Screen Split',
  description: 'Big type on one screen, the full lyrics on the other.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'two screens',
  isNew: true,
  usesIcons: false,
  gradient: ['#060a10', '#9ec5ff'],
  palette: {
    accent: '#9ec5ff',
    text: '#eff6ff',
    dim: 'rgba(239,246,255,0.28)',
    background: '#060a10',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const panes = panesFor(width, height);

    // Wall pane: the surrounding lines, current one lit.
    const rowSize = Math.min(panes.wall.height * 0.06, panes.wall.width / 12);
    const rowHeight = rowSize * 1.8;
    const rows = wallRows(panes.wall.height, rowHeight);
    const from = Math.max(0, state.activeIndex - Math.floor(rows / 2));
    const to = Math.min(state.lines.length - 1, from + rows - 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(panes.wall.x, panes.wall.y, panes.wall.width, panes.wall.height);
    ctx.clip();
    ctx.fillStyle = 'rgba(158,197,255,0.04)';
    ctx.fillRect(panes.wall.x, panes.wall.y, panes.wall.width, panes.wall.height);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let index = from; index <= to; index += 1) {
      const row = state.lines[index];
      if (!row.text.trim()) continue;
      const y = panes.wall.y + (index - from) * rowHeight + rowHeight * 0.8;
      const active = index === state.activeIndex;
      ctx.font = fontOf(rowSize, active ? 700 : 500);
      ctx.fillStyle = active ? palette.accent : palette.dim;
      let text = row.text;
      while (text.length > 4 && ctx.measureText(text).width > panes.wall.width * 0.9) {
        text = `${text.slice(0, -2)}…`;
      }
      ctx.fillText(text, panes.wall.x + panes.wall.width * 0.06, y);
    }
    ctx.restore();

    // Main pane: the line, big.
    const words = wordsOf(line);
    const size = Math.min(panes.main.height * 0.11, panes.main.width / 9);
    const laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.28, panes.main.width * 0.86, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineHeight = size * 1.24;
    const top = panes.main.y + panes.main.height / 2 - (laid.rows.length * lineHeight) / 2;

    laid.rows.forEach((row, rowIndex) => {
      const rowWidth = laid.rowWidths[rowIndex] ?? 0;
      let x = panes.main.x + panes.main.width / 2 - rowWidth / 2;
      const y = top + rowIndex * lineHeight + lineHeight / 2;
      for (const item of row) {
        ctx.font = fontOf(size, item.wordIndex === state.wordIndex ? 800 : 600);
        ctx.textAlign = 'left';
        ctx.fillStyle = item.wordIndex === state.wordIndex ? palette.accent : palette.text;
        ctx.fillText(item.text, x, y);
        x += item.width + size * 0.28;
      }
    });

    if (panes.split) {
      ctx.strokeStyle = 'rgba(158,197,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(panes.main.width, 0);
      ctx.lineTo(panes.main.width, height);
      ctx.stroke();
    }
  },
};
