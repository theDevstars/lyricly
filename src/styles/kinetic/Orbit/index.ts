import type { LyricStyle } from '../../types';
import { backdrop, placeholder } from '../../lib/draw';
import { activeLine, fontOf, wordsOf } from '../../lib/text';
import { energyOf } from '../../lib/energy';
import { depthAlpha, depthScale, ringAngle, ringRadius } from './model';

/**
 * Orbit — the line circles an album disc as a ring of text; the word being sung
 * swings to the front and grows, and the ring turns with the beat.
 */
export const orbit: LyricStyle = {
  id: 'orbit',
  name: 'Orbit',
  description: 'Words circle the album art, and the one being sung swings to the front.',
  group: 'kinetic',
  eyebrow: 'Kinetic type',
  sample: 'Orbit',
  isNew: true,
  usesIcons: false,
  gradient: ['#05102b', '#7b6bff'],
  palette: {
    accent: '#7b6bff',
    text: '#f2f0ff',
    dim: 'rgba(242,240,255,0.32)',
    background: '#050a18',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    backdrop(ctx, width, height, '#050a18', '#0a1330');

    const line = activeLine(state.lines, state.activeIndex);
    const cx = width / 2;
    const cy = height / 2;
    const radius = ringRadius(width, height);
    const energy = energyOf(state);

    // The disc.
    const disc = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 4, cx, cy, radius * 0.62);
    disc.addColorStop(0, 'rgba(123,107,255,0.55)');
    disc.addColorStop(1, 'rgba(10,14,36,0.95)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(123,107,255,0.12)';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (0.6 + ring * 0.12), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const words = wordsOf(line);
    const size = Math.min(height * 0.058, width / 22);
    const spin = state.time / 9000 + energy.pulse * 0.2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    words.forEach((word, index) => {
      const angle = ringAngle(index, state.wordIndex, words.length, spin);
      const scale = depthScale(angle) * (index === state.wordIndex ? 1.35 : 1);
      const alpha = index === state.wordIndex ? 1 : depthAlpha(angle);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.font = fontOf(size, index === state.wordIndex ? 700 : 500);
      ctx.fillStyle = index === state.wordIndex ? palette.accent : palette.text;
      if (index === state.wordIndex) {
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 20;
      }
      ctx.fillText(word.text, 0, 0);
      ctx.restore();
    });
  },
};
