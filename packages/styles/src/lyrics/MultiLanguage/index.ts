import type { LyricStyle } from '../../types';
import { placeholder, rrect } from '../../lib/draw';
import { activeLine, fontOf } from '../../lib/text';
import { machineTranslated, rowScale, rowsFor } from './model';

/**
 * Multi-Language Stack — original, romanisation and translation in three rows,
 * each with its own size and colour, with a clear machine-translation tag.
 */
export const multiLanguage: LyricStyle = {
  id: 'multi-language',
  name: 'Multi-Language Stack',
  description: 'Original, romanization and translation together.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'original / translation',
  isNew: true,
  usesIcons: false,
  gradient: ['#050a10', '#8ef0c8'],
  palette: {
    accent: '#8ef0c8',
    text: '#eafff7',
    dim: 'rgba(234,255,247,0.34)',
    background: '#050a10',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#050a10';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const rows = rowsFor(line.text);
    const size = Math.min(height * 0.085, width / 14);
    let y = height / 2 - (rows.length * size * 1.35) / 2 + size * 0.6;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    rows.forEach((row, index) => {
      const scaled = size * rowScale(row.kind);
      ctx.font = fontOf(scaled, row.kind === 'original' ? 700 : 400);
      ctx.fillStyle =
        row.kind === 'original' ? palette.text : row.kind === 'translation' ? palette.accent : palette.dim;
      let text = row.text;
      while (text.length > 4 && ctx.measureText(text).width > width * 0.9) {
        text = `${text.slice(0, -2)}…`;
      }
      ctx.fillText(text, width / 2, y);
      y += scaled * 1.45 + size * 0.22;
      if (index === 0 && rows.length > 1) {
        ctx.fillStyle = 'rgba(234,255,247,0.12)';
        ctx.fillRect(width * 0.32, y - size * 0.5, width * 0.36, 1);
      }
    });

    if (machineTranslated(rows)) {
      ctx.font = fontOf(size * 0.3, 600);
      ctx.textAlign = 'right';
      const label = 'machine translation';
      const tagWidth = ctx.measureText(label).width + size * 0.6;
      ctx.fillStyle = 'rgba(142,240,200,0.16)';
      rrect(ctx, width - tagWidth - size * 0.8, size * 0.8, tagWidth, size * 0.8, size * 0.4);
      ctx.fill();
      ctx.fillStyle = palette.accent;
      ctx.fillText(label, width - size * 1.1, size * 1.2);
    }
  },
};
