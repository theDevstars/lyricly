import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf } from '../../lib/text';
import { clampCount, focus, windowLines } from './model';

/**
 * Context Window — several lines at once: the sung line is sharp and large, the
 * ones above and below shrink and blur, and the column scrolls smoothly.
 */
export const contextWindow: LyricStyle = {
  id: 'context-window',
  name: 'Context Window',
  description: 'Several lines at once, with the current one in focus.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'Three lines',
  isNew: true,
  usesIcons: false,
  gradient: ['#050b12', '#7ad4ff'],
  palette: {
    accent: '#7ad4ff',
    text: '#eaf6ff',
    dim: 'rgba(234,246,255,0.32)',
    background: '#050b12',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    const paint = ctx.createLinearGradient(0, 0, 0, height);
    paint.addColorStop(0, '#050b12');
    paint.addColorStop(1, '#081722');
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, width, height);

    if (!activeLine(state.lines, state.activeIndex)) {
      placeholder(ctx, state);
      return;
    }

    const count = clampCount(Number(state.styleOptions?.contextLines ?? 5));
    const indices = windowLines(state.lines.length, Math.max(0, state.activeIndex), count);
    const size = Math.min(height * 0.06, width / 18);
    const gap = size * 1.9;
    const centerY = height / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const index of indices) {
      const line = state.lines[index];
      const raw = line.text.trim();
      if (!raw) continue;
      const distance = index - state.activeIndex;
      const look = focus(distance);
      const active = distance === 0;
      const scaled = size * look.scale;

      // Long lines are trimmed rather than allowed to overflow.
      ctx.font = fontOf(scaled, active ? 700 : 500);
      let text = raw;
      while (text.length > 4 && ctx.measureText(text).width > width * 0.88) {
        text = `${text.slice(0, -2)}…`;
      }

      ctx.save();
      ctx.globalAlpha = active ? 1 : look.alpha;
      if (look.blur > 0 && ctx.filter !== undefined) ctx.filter = `blur(${look.blur.toFixed(1)}px)`;
      ctx.fillStyle = active ? palette.accent : palette.text;
      ctx.fillText(text, width / 2, centerY + distance * gap);
      ctx.restore();
    }

    // A soft scrim at the edges so the column reads as scrolling.
    const scrim = ctx.createLinearGradient(0, 0, 0, height);
    scrim.addColorStop(0, 'rgba(5,11,18,0.9)');
    scrim.addColorStop(0.22, 'rgba(5,11,18,0)');
    scrim.addColorStop(0.78, 'rgba(5,11,18,0)');
    scrim.addColorStop(1, 'rgba(5,11,18,0.9)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);
  },
};
