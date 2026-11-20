import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, isRtl, layoutWords, wordsOf } from '../../lib/text';
import { backingScale, splitBacking } from './model';

/**
 * Backing Layer — the lead line is big; ad-libs and backing vocals in brackets
 * appear in a smaller second layer in the secondary colour.
 */
export const backingLayer: LyricStyle = {
  id: 'backing-layer',
  name: 'Backing Layer',
  description: 'Main vocals big, backing vocals in a second layer.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'lead / (back)',
  isNew: true,
  usesIcons: false,
  gradient: ['#0a0710', '#ff9f6b'],
  palette: {
    accent: '#ff9f6b',
    text: '#fff3ec',
    dim: 'rgba(255,243,236,0.32)',
    background: '#0a0710',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#0a0710';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const { lead, backing } = splitBacking(line.text);
    const words = wordsOf(line);
    const size = Math.min(height * 0.1, width / 12);
    const laid = layoutWords(
      words.filter((word) => !/^[（(]|[）)]$/.test(word.text)),
      (text) => ctx.measureText(text).width,
      size * 0.3,
      width * 0.86,
      size,
    );

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Lead line, word by word.
    const rows = laid.rows.length ? laid.rows : [[{ text: lead || line.text, wordIndex: 0, startMs: line.startMs, endMs: line.endMs, x: 0, width: 0 }]];
    const lineHeight = size * 1.26;
    const top = height / 2 - (rows.length * lineHeight) / 2 - (backing ? size * 0.5 : 0);

    rows.forEach((row, rowIndex) => {
      const rowWidth = row.reduce((sum, item) => sum + item.width, 0) + size * 0.3 * Math.max(0, row.length - 1);
      let x = width / 2 - rowWidth / 2;
      const y = top + rowIndex * lineHeight;
      for (const item of row) {
        const active = item.wordIndex === state.wordIndex;
        ctx.font = fontOf(size, active ? 800 : 600);
        ctx.textAlign = isRtl(item.text) ? 'right' : 'left';
        ctx.fillStyle = active ? palette.accent : palette.text;
        ctx.fillText(item.text, isRtl(item.text) ? x + item.width : x, y);
        x += item.width + size * 0.3;
      }
    });

    // The backing layer, smaller and in the accent colour.
    if (backing) {
      const backSize = size * backingScale(lead, backing);
      ctx.font = fontOf(backSize, 500);
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.85;
      ctx.fillText(`(${backing})`, width / 2, top + rows.length * lineHeight + backSize * 0.9);
      ctx.globalAlpha = 1;
    }
  },
};
