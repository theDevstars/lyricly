import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { split, tears, trackingY } from './model';

/**
 * Glitch VHS — chorus lines tear and split on the beat with scan lines and a
 * tracking band. Photosensitivity mode and Reduce Motion both fall back to calm,
 * unbroken type.
 */
export const glitchVhs: LyricStyle = {
  id: 'glitch-vhs',
  name: 'Glitch VHS',
  description: 'Chorus lines tear and split on every beat.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Glitch',
  isNew: true,
  usesIcons: false,
  gradient: ['#0b0a14', '#ff3ea5'],
  palette: {
    accent: '#ff3ea5',
    text: '#eafaff',
    dim: 'rgba(234,250,255,0.3)',
    background: '#07060d',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#07060d';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const calm = Boolean(state.photosensitive) || Boolean(state.reduceMotion);
    const words = wordsOf(line);
    let size = Math.min(height * 0.13, width / 9);
    let laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, width * 0.86, size);
    for (let attempt = 0; attempt < 6 && laid.rows.length > 2; attempt += 1) {
      size *= 0.84;
      ctx.font = fontOf(size, 700);
      laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, width * 0.86, size);
    }

    const lineHeight = size * 1.24;
    const top = height / 2 - (laid.rows.length * lineHeight) / 2 + lineHeight / 2;
    const shift = split(state.time, calm);
    const bands = tears(state.time, height, calm, state.activeIndex + 1);

    // Scan lines.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);

    const paint = (offsetX: number, color: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      laid.rows.forEach((row, rowIndex) => {
        const rowWidth = laid.rowWidths[rowIndex] ?? 0;
        let x = width / 2 - rowWidth / 2;
        const y = top + rowIndex * lineHeight;
        for (const item of row) {
          ctx.save();
          ctx.beginPath();
          // Tear bands clip and shift a slice of the row.
          for (const band of bands) {
            if (band.y > y - lineHeight && band.y < y + lineHeight) {
              ctx.rect(x - shift, band.y, width, band.height);
            }
          }
          if (bands.length > 0) ctx.clip();
          ctx.font = fontOf(size, item.wordIndex === state.wordIndex ? 800 : 600);
          ctx.textAlign = 'left';
          ctx.fillText(item.text, x + offsetX, y);
          ctx.restore();
          x += item.width + size * 0.3;
        }
      });
      ctx.restore();
    };

    // Clean base line, then the RGB split copies on top.
    paint(0, palette.text, 1);
    paint(-shift, '#ff2a4d', 0.55);
    paint(shift, '#20e0ff', 0.5);

    // Tracking noise band.
    if (!calm) {
      const bandY = trackingY(state.time, height);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, bandY, width, 18);
      ctx.fillStyle = 'rgba(255,62,165,0.12)';
      ctx.fillRect(0, bandY + 18, width, 4);
    }

    if (state.wordIndex >= 0) {
      ctx.font = fontOf(size * 0.24, 500);
      ctx.fillStyle = palette.dim;
      ctx.textAlign = 'left';
      ctx.fillText('▶ PLAY', width * 0.05, height * 0.09);
    }
  },
};
