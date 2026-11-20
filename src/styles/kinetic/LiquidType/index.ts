import type { LyricStyle } from '../../types';
import { clamp01 } from '../../types';
import { backdrop, placeholder } from '../../lib/draw';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { activeScale, letterOffset } from './model';

/**
 * Liquid Type — the line sits in water: letters ripple on a slow wave and the
 * word being sung swells like a drop before settling into the next.
 */
export const liquidType: LyricStyle = {
  id: 'liquid-type',
  name: 'Liquid Type',
  description: 'Letters ripple like water, and the active word swells like a drop.',
  group: 'kinetic',
  eyebrow: 'Kinetic type',
  sample: 'Ripple',
  isNew: true,
  usesIcons: false,
  gradient: ['#02121f', '#2fd8c8'],
  palette: {
    accent: '#2fd8c8',
    text: '#eafcff',
    dim: 'rgba(234,252,255,0.34)',
    background: '#04101a',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    backdrop(ctx, width, height, '#04101a', '#062736');

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const words = wordsOf(line);
    const maxWidth = width * 0.88;
    let size = Math.min(height * 0.13, width / 10);
    let laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, maxWidth, size);
    for (let attempt = 0; attempt < 6 && laid.rows.length > 2; attempt += 1) {
      size *= 0.84;
      ctx.font = fontOf(size, 600);
      laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, maxWidth, size);
    }

    ctx.font = fontOf(size, 600);
    ctx.textBaseline = 'middle';
    const lineHeight = size * 1.3;
    const top = height / 2 - (laid.rows.length * lineHeight) / 2 + lineHeight / 2;

    laid.rows.forEach((row, rowIndex) => {
      const rowWidth = laid.rowWidths[rowIndex] ?? 0;
      let x = width / 2 - rowWidth / 2;
      const y = top + rowIndex * lineHeight;

      for (const item of row) {
        const isActive = item.wordIndex === state.wordIndex;
        const scale = activeScale(isActive, state.wordProgress);
        const wordHeight = size * scale;

        ctx.save();
        ctx.translate(x + item.width / 2, y);
        ctx.scale(scale, 1 / scale * scale);

        // Letters ripple, each lagging the one before it.
        let cursor = -item.width / 2;
        ctx.textAlign = 'left';
        for (let letter = 0; letter < item.text.length; letter += 1) {
          const glyph = item.text[letter];
          const advance = ctx.measureText(glyph).width;
          const offset = letterOffset(cursor + rowWidth / 2, state.time, isActive ? 5 : 2.5);
          ctx.fillStyle = isActive
            ? palette.accent
            : clamp01((state.positionMs - item.startMs) / 600) > 0
              ? palette.text
              : palette.dim;
          ctx.fillText(glyph, cursor, offset);
          cursor += advance;
        }

        if (isActive) {
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = palette.accent;
          ctx.beginPath();
          ctx.ellipse(0, wordHeight * 0.52, item.width * 0.55, size * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        x += item.width + size * 0.3;
      }
    });
  },
};
