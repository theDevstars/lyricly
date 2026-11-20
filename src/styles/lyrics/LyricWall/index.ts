import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { fontOf } from '../../lib/text';
import { distanceRows, rowAlpha, wallOffset } from './model';

/**
 * Lyric Wall — every lyric on a scrolling wall, the current line lit and
 * centred, the rest dimmed. The wall follows the playhead smoothly.
 */
export const lyricWall: LyricStyle = {
  id: 'lyric-wall',
  name: 'Lyric Wall',
  description: 'Every lyric on a scrolling wall, with the current line lit.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'Whole song',
  isNew: true,
  usesIcons: false,
  gradient: ['#08070c', '#b39dff'],
  palette: {
    accent: '#b39dff',
    text: '#f3efff',
    dim: 'rgba(243,239,255,0.25)',
    background: '#08070c',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#08070c';
    ctx.fillRect(0, 0, width, height);

    if (state.lines.length === 0 || state.activeIndex < 0) {
      placeholder(ctx, state);
      return;
    }

    const size = Math.min(height * 0.055, width / 20);
    const rowHeight = size * 1.9;
    const offset = wallOffset(state.activeIndex, rowHeight, height);
    const start = Math.max(0, state.activeIndex - Math.ceil(height / rowHeight));
    const end = Math.min(state.lines.length - 1, state.activeIndex + Math.ceil(height / rowHeight));

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (let index = start; index <= end; index += 1) {
      const line = state.lines[index];
      if (!line.text.trim()) continue;
      const distance = distanceRows(index, state.activeIndex);
      const y = offset + index * rowHeight + rowHeight / 2;
      ctx.save();
      ctx.globalAlpha = rowAlpha(distance);
      ctx.font = fontOf(size * (distance === 0 ? 1.15 : 1), distance === 0 ? 700 : 500);
      ctx.fillStyle = distance === 0 ? palette.accent : palette.text;
      let text = line.text;
      while (text.length > 4 && ctx.measureText(text).width > width * 0.86) {
        text = `${text.slice(0, -2)}…`;
      }
      ctx.fillText(text, width / 2, y);
      ctx.restore();
    }

    // Fade the edges into the background.
    const scrim = ctx.createLinearGradient(0, 0, 0, height);
    scrim.addColorStop(0, 'rgba(8,7,12,0.95)');
    scrim.addColorStop(0.3, 'rgba(8,7,12,0)');
    scrim.addColorStop(0.7, 'rgba(8,7,12,0)');
    scrim.addColorStop(1, 'rgba(8,7,12,0.95)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);
  },
};
