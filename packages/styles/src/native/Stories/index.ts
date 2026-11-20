import type { LyricStyle } from '../../types';
import { rrect } from '../../lib/draw';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { progressBar, swipe, tilt } from './model';

/**
 * Native Design Stories — a vertical 9:16 card per line, sticker-style words and
 * a progress bar across the top, swiping to the next card each line.
 */
export const stories: LyricStyle = {
  id: 'native-stories',
  name: 'Native Design Stories',
  description: 'A story card for every line.',
  group: 'native',
  eyebrow: 'Native Design',
  sample: 'Story',
  isNew: true,
  usesIcons: false,
  gradient: ['#1b0a22', '#ff6ad5'],
  palette: {
    accent: '#ff6ad5',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.4)',
    background: '#120617',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#120617';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      ctx.fillStyle = palette.dim;
      ctx.font = fontOf(Math.min(20, width / 34), 500);
      ctx.textAlign = 'center';
      ctx.fillText('Play a track to start the story', width / 2, height / 2);
      return;
    }

    // Card: a 9:16 rounded panel, centred, no wider than the stage allows.
    const cardHeight = Math.min(height * 0.92, width * 1.2 * (16 / 9));
    const cardWidth = cardHeight * (9 / 16);
    const x = width / 2 - cardWidth / 2;
    const y = height / 2 - cardHeight / 2 + swipe(state.lineProgress, height);

    const paint = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight);
    paint.addColorStop(0, '#2a0f35');
    paint.addColorStop(1, '#0f0715');
    ctx.save();
    rrect(ctx, x, y, cardWidth, cardHeight, cardHeight * 0.045);
    ctx.fillStyle = paint;
    ctx.fill();
    ctx.clip();

    // Progress bars: one per line, filled as the song advances.
    const bars = Math.min(12, Math.max(3, state.lines.length));
    const barWidth = (cardWidth - cardHeight * 0.08) / bars;
    for (let index = 0; index < bars; index += 1) {
      const done = progressBar(state.activeIndex + index, state.lines.length, state.lineProgress);
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      rrect(ctx, x + cardHeight * 0.04 + index * barWidth, y + cardHeight * 0.045, barWidth * 0.86, cardHeight * 0.006, 3);
      ctx.fill();
      ctx.fillStyle = palette.text;
      rrect(ctx, x + cardHeight * 0.04 + index * barWidth, y + cardHeight * 0.045, barWidth * 0.86 * done, cardHeight * 0.006, 3);
      ctx.fill();
    }

    // The sticker word block.
    const words = wordsOf(line);
    const size = cardWidth * 0.13;
    const laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, cardWidth * 0.78, size);
    ctx.font = fontOf(size, 800);
    ctx.textBaseline = 'middle';

    let rowY = y + cardHeight * 0.4;
    laid.rows.forEach((row) => {
      const rowWidth = laid.rowWidths[laid.rows.indexOf(row)] ?? 0;
      let cursor = x + cardWidth / 2 - rowWidth / 2;
      for (const item of row) {
        ctx.save();
        ctx.translate(cursor + item.width / 2, rowY);
        ctx.rotate(tilt(state.activeIndex + item.wordIndex));
        ctx.textAlign = 'center';
        ctx.fillStyle = item.wordIndex === state.wordIndex ? palette.accent : palette.text;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillText(item.text, 0, 0);
        ctx.restore();
        cursor += item.width + size * 0.3;
      }
      rowY += size * 1.35;
    });

    // Footer: author chip and a swipe hint.
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rrect(ctx, x + cardHeight * 0.05, y + cardHeight * 0.86, cardWidth * 0.5, cardHeight * 0.055, cardHeight * 0.03);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.font = fontOf(size * 0.32, 600);
    ctx.textAlign = 'left';
    ctx.fillText(state.track.artist || 'Lyrica', x + cardHeight * 0.075, y + cardHeight * 0.892);

    ctx.restore();
  },
};
