import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { keyWordIndex, letterbox, subtitleAlpha } from './model';

/**
 * Subtitle Cinema — movie subtitles over a dimmed frame, with letterbox bars, a
 * key word picked out in colour and a fade between lines.
 */
export const subtitleCinema: LyricStyle = {
  id: 'subtitle-cinema',
  name: 'Subtitle Cinema',
  description: 'Movie subtitles with the key word picked out in color.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Subtitle',
  isNew: true,
  usesIcons: false,
  gradient: ['#0a0a0c', '#f2d19b'],
  palette: {
    accent: '#f2d19b',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.35)',
    background: '#08080a',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    // A dim frame, as if the film were paused behind the subtitle.
    const frame = ctx.createRadialGradient(width / 2, height / 2, height * 0.1, width / 2, height / 2, height * 0.9);
    frame.addColorStop(0, '#1b1c22');
    frame.addColorStop(1, '#06060a');
    ctx.fillStyle = frame;
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    const bars = letterbox(height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, bars);
    ctx.fillRect(0, height - bars, width, bars);

    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const words = wordsOf(line);
    let size = Math.min(height * 0.075, width / 16);
    let laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, width * 0.8, size);
    for (let attempt = 0; attempt < 6 && laid.rows.length > 2; attempt += 1) {
      size *= 0.86;
      ctx.font = fontOf(size, 500);
      laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, width * 0.8, size);
    }

    const key = keyWordIndex(words);
    const alpha = subtitleAlpha(state.lineProgress);
    const lineHeight = size * 1.3;
    const baseY = height - bars - size * 1.6 - (laid.rows.length - 1) * lineHeight;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'middle';

    laid.rows.forEach((row, rowIndex) => {
      const rowWidth = laid.rowWidths[rowIndex] ?? 0;
      let x = width / 2 - rowWidth / 2;
      const y = baseY + rowIndex * lineHeight;
      for (const item of row) {
        const lit = item.wordIndex === state.wordIndex;
        const keyed = item.wordIndex === key;
        ctx.font = fontOf(size, lit ? 600 : 500);
        ctx.textAlign = 'left';
        ctx.fillStyle = keyed ? palette.accent : palette.text;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(item.text, x, y);
        x += item.width + size * 0.3;
      }
    });
    ctx.restore();

    // Faint film grain and a reel counter for atmosphere.
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    for (let dot = 0; dot < 60; dot += 1) {
      const x = (dot * 733) % width;
      const y = (dot * 199) % height;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  },
};
