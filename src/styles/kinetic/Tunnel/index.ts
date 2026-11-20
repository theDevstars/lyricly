import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, wordsOf } from '../../lib/text';
import { depthOf, project, stars } from './model';

const FIELD = stars(120);

/**
 * Tunnel — words fly out of the dark toward the viewer and rush past the camera
 * as they are sung, with a starfield for depth.
 */
export const tunnel: LyricStyle = {
  id: 'tunnel',
  name: 'Tunnel',
  description: "Words fly at you through a starfield as they're sung.",
  group: 'kinetic',
  eyebrow: 'Kinetic type',
  sample: 'Rush',
  isNew: true,
  defaultEffects: ['particles', 'reactive'],
  usesIcons: false,
  gradient: ['#02030a', '#39d6ff'],
  palette: {
    accent: '#39d6ff',
    text: '#e8fbff',
    dim: 'rgba(232,251,255,0.3)',
    background: '#02030a',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, width, height);

    // Starfield: each point drifts toward the camera and wraps.
    const drift = (state.time / 14) % 2400;
    ctx.fillStyle = 'rgba(140, 220, 255, 0.55)';
    for (const star of FIELD) {
      const z = ((star.z - drift) % 2400 + 2400) % 2400 + 10;
      const point = project(star.x, star.y, z, width, height);
      if (!point.visible) continue;
      const size = Math.min(2.4, point.scale * 1.6);
      ctx.globalAlpha = Math.min(0.7, point.scale * 0.7);
      ctx.fillRect(point.x, point.y, size, size);
    }
    ctx.globalAlpha = 1;

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const words = wordsOf(line);
    const size = Math.min(height * 0.16, width / 9);

    words.forEach((word, index) => {
      const z = depthOf(index, state.wordIndex, state.wordProgress);
      const point = project((index - state.wordIndex) * 120, 0, z, width, height);
      if (!point.visible) return;
      // Near words project enormous glyphs; keep them on the stage.
      if (point.x < -width || point.x > width * 2 || point.y < -height || point.y > height * 2) return;
      if (point.scale > 3) return;

      const alpha = Math.min(1, Math.max(0, 1.2 - z / 900));
      const active = index === state.wordIndex;
      const glyph = Math.min(size * 2.4, size * point.scale * 6);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = fontOf(glyph, active ? 700 : 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = active ? palette.accent : palette.text;
      if (active) {
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 24;
      }
      ctx.fillText(word.text, point.x, point.y);

      // Motion blur: a short trail back toward the vanishing point.
      if (active) {
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillText(word.text, width / 2 + (point.x - width / 2) * 0.82, height / 2 + (point.y - height / 2) * 0.82);
      }
      ctx.restore();
    });
  },
};
