import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { fontOf } from '../../lib/text';
import { echo, trailLength } from './model';

/**
 * Echo Trail — past lines shrink, fade and drift into the distance, leaving a
 * layered history of the song with the current line in front.
 */
export const echoTrail: LyricStyle = {
  id: 'echo-trail',
  name: 'Echo Trail',
  description: 'Past lines fade back into the distance, leaving a trail.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: 'echo…',
  isNew: true,
  usesIcons: false,
  gradient: ['#05070d', '#6fe3ff'],
  palette: {
    accent: '#6fe3ff',
    text: '#eaf9ff',
    dim: 'rgba(234,249,255,0.3)',
    background: '#05070d',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    const paint = ctx.createRadialGradient(width / 2, height * 0.62, 10, width / 2, height * 0.6, height);
    paint.addColorStop(0, '#0a1524');
    paint.addColorStop(1, '#05070d');
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, width, height);

    if (state.activeIndex < 0 || state.lines.length === 0) {
      placeholder(ctx, state);
      return;
    }

    const depth = trailLength(height);
    const size = Math.min(height * 0.07, width / 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let age = depth; age >= 0; age -= 1) {
      const index = state.activeIndex - age;
      const line = state.lines[index];
      if (!line || !line.text.trim()) continue;
      const look = echo(age);
      const y = height * 0.62 - look.lift * size * 0.55;

      ctx.save();
      ctx.globalAlpha = age === 0 ? 1 : look.alpha;
      ctx.translate(width / 2, y);
      ctx.scale(look.scale, look.scale);
      ctx.font = fontOf(size, age === 0 ? 800 : 500);
      ctx.fillStyle = age === 0 ? palette.accent : palette.text;
      if (age === 0) {
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 22;
      }
      let text = line.text;
      while (text.length > 4 && ctx.measureText(text).width > (width * 0.8) / look.scale) {
        text = `${text.slice(0, -2)}…`;
      }
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    // The word being sung, picked out under the main line.
    const words = state.lines[state.activeIndex]?.words ?? [];
    const current = words[state.wordIndex];
    if (current) {
      ctx.font = fontOf(size * 0.52, 600);
      ctx.fillStyle = palette.dim;
      ctx.fillText(current.text, width / 2, height * 0.62 + size * 1.15);
    }
  },
};
