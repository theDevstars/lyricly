import type { LyricStyle } from '../../types';
import { activeLine, fontOf } from '../../lib/text';
import { isStrip, nextLineText, stripSize, trim } from './model';

/**
 * Mini Strip — one line, optionally with the next, in a compact pill. Meant for
 * a small click-through window kept on top while gaming or working.
 */
export const miniStrip: LyricStyle = {
  id: 'mini-strip',
  name: 'Mini Strip',
  description: 'A tiny always-on-top line for when you are busy.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'one line',
  isNew: true,
  usesIcons: false,
  gradient: ['#05070a', '#9be7b0'],
  palette: {
    accent: '#9be7b0',
    text: '#eefaf1',
    dim: 'rgba(238,250,241,0.5)',
    background: 'rgba(6,10,8,0.72)',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.clearRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      ctx.fillStyle = palette.dim;
      ctx.font = fontOf(stripSize(height) * 0.8, 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.track.title ? '♪' : 'Nothing playing', width / 2, height / 2);
      return;
    }

    const strip = isStrip(height, width);
    if (strip) {
      // A translucent pill behind the text when the stage is a real strip.
      const radius = Math.min(height / 2, 18);
      ctx.fillStyle = 'rgba(6,10,8,0.55)';
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.arcTo(width, 0, width, height, radius);
      ctx.arcTo(width, height, 0, height, radius);
      ctx.arcTo(0, height, 0, 0, radius);
      ctx.arcTo(0, 0, width, 0, radius);
      ctx.closePath();
      ctx.fill();
    }

    const size = stripSize(height);
    const maxWidth = width * 0.92;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontOf(size, 600);
    ctx.fillStyle = palette.text;
    const current = trim(line.text, (value) => ctx.measureText(value).width, maxWidth);
    const next = nextLineText(state.lines, state.activeIndex);

    const showNext = !strip && Boolean(next);
    const y = showNext ? height * 0.42 : height / 2;
    ctx.fillText(current, width / 2, y);

    if (showNext) {
      ctx.font = fontOf(size * 0.62, 500);
      ctx.fillStyle = palette.dim;
      ctx.fillText(trim(next, (value) => ctx.measureText(value).width, maxWidth), width / 2, height * 0.78);
    }

    // A hairline that fills with the line's progress.
    if (strip) {
      ctx.fillStyle = 'rgba(155,231,176,0.2)';
      ctx.fillRect(0, height - 2, width, 2);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(0, height - 2, width * Math.min(1, state.lineProgress), 2);
    }
  },
};
