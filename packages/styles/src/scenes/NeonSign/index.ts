import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { fontOf, layoutWords, wordsOf, activeLine } from '../../lib/text';
import { ignite, reflection, tubeBrightness } from './model';

/**
 * Neon Sign — each line flickers on like a neon tube against a dark wall, with a
 * warm glow and a faint reflection. Flicker is capped for photosensitivity.
 */
export const neonSign: LyricStyle = {
  id: 'neon-sign',
  name: 'Neon Sign',
  description: 'Each line flickers on like a neon tube.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Neon',
  isNew: true,
  usesIcons: false,
  gradient: ['#160309', '#ff4d8d'],
  palette: {
    accent: '#ff4d8d',
    text: '#ffe9f1',
    dim: 'rgba(255,233,241,0.3)',
    background: '#0a0306',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#0a0306';
    ctx.fillRect(0, 0, width, height);

    const wall = ctx.createLinearGradient(0, 0, 0, height);
    wall.addColorStop(0, '#0d0407');
    wall.addColorStop(1, '#050203');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const words = wordsOf(line);
    let size = Math.min(height * 0.12, width / 10);
    let laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.34, width * 0.85, size);
    for (let attempt = 0; attempt < 6 && laid.rows.length > 2; attempt += 1) {
      size *= 0.84;
      ctx.font = fontOf(size, 700);
      laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.34, width * 0.85, size);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineHeight = size * 1.3;
    const draw = (mirror: boolean, yBase: number, alpha: number) => {
      laid.rows.forEach((row, rowIndex) => {
        const rowWidth = laid.rowWidths[rowIndex] ?? 0;
        let x = width / 2 - rowWidth / 2;
        const y = yBase + rowIndex * lineHeight;
        for (const item of row) {
          const active = item.wordIndex === state.wordIndex;
          const brightness =
            tubeBrightness(state.time, item.wordIndex, state.activeIndex, Boolean(state.photosensitive)) *
            ignite(state.lineProgress, item.wordIndex, words.length);
          ctx.save();
          ctx.globalAlpha = alpha * Math.max(0.15, brightness);
          ctx.font = fontOf(size, active ? 800 : 600);
          ctx.translate(x + item.width / 2, mirror ? y : y);
          if (mirror) ctx.scale(1, -0.55);
          ctx.fillStyle = active ? '#ffffff' : palette.accent;
          ctx.shadowColor = palette.accent;
          ctx.shadowBlur = mirror ? 10 : 26;
          ctx.fillText(item.text, 0, 0);
          ctx.restore();
          x += item.width + size * 0.34;
        }
      });
    };

    const center = height / 2 - lineHeight * (laid.rows.length - 1) * 0.3;
    draw(false, center, 1);
    draw(true, center + lineHeight * 1.9, reflection(height));
  },
};
