import type { LyricStyle } from '../../types';
import { backdrop, layoutActive, paintRows, sung } from '../../lib/draw';
import { fontOf } from '../../lib/text';
import { cursorRadius, fillAt, fillEdge } from './model';

/**
 * Karaoke Sweep — each word fills left to right exactly with the vocal, a glowing
 * cursor rides the fill edge, past words stay filled and upcoming words sit dim.
 */
export const karaokeSweep: LyricStyle = {
  id: 'karaoke-sweep',
  name: 'Karaoke Sweep',
  description: "Each word fills with color at the exact moment it's sung.",
  group: 'kinetic',
  eyebrow: 'Kinetic type',
  sample: 'Sing it',
  isNew: true,
  usesIcons: false,
  gradient: ['#12021b', '#ff2e88'],
  palette: {
    accent: '#ff2e88',
    text: '#f7f2ff',
    dim: 'rgba(247,242,255,0.34)',
    background: '#0a0310',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    backdrop(ctx, width, height, '#0a0310', '#150423');

    const layout = layoutActive(ctx, state, { maxRows: 2, weight: 700 });
    if (!layout) {
      ctx.fillStyle = palette.dim;
      ctx.font = fontOf(Math.min(22, width / 34), 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.track.title ? '♪' : 'Play a track to see lyrics', width / 2, height / 2);
      return;
    }

    ctx.textBaseline = 'middle';
    ctx.font = fontOf(layout.size, 700);

    paintRows(state, layout, {}, ({ x, y, row }) => {
      const align: CanvasTextAlign = layout.rtl ? 'right' : 'left';
      // RTL lines are painted from the right edge of the row.
      const origin = layout.rtl ? x + (layout.rowWidths[layout.rows.indexOf(row)] ?? 0) : x;
      for (const item of row) {
        const at = align === 'right' ? origin - item.x : origin + item.x;
        const progress = sung(state, item.startMs, item.endMs);
        const fill = fillAt(item, state.positionMs, item.wordIndex, state.wordIndex);
        const base = fill.upcoming ? 'rgba(247,242,255,0.28)' : 'rgba(247,242,255,0.72)';

        ctx.textAlign = align;
        ctx.fillStyle = base;
        ctx.fillText(item.text, at, y);

        const amount = progress >= 1 ? 1 : fill.amount;
        if (amount > 0) {
          ctx.save();
          const left = align === 'right' ? at - item.width : at;
          ctx.beginPath();
          ctx.rect(left, y - layout.size, fillEdge(item.width, amount), layout.size * 2);
          ctx.clip();
          ctx.fillStyle = palette.accent;
          ctx.shadowColor = palette.accent;
          ctx.shadowBlur = fill.current ? 18 : 6;
          ctx.fillText(item.text, at, y);
          ctx.restore();

          if (fill.current) {
            const edge =
              align === 'right'
                ? left + item.width * amount
                : left + item.width * amount;
            const radius = cursorRadius(height);
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = palette.accent;
            ctx.shadowBlur = 22;
            ctx.arc(edge, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }
    });
  },
};
