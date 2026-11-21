import type { LyricStyle } from '../../types';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { penAt } from '../../lib/strokePath';
import { inkBleed, reveal, writing } from './model';

const FACE = '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';

/**
 * Handwriting — the line is written left to right with a pen that rides the
 * reveal edge, on ruled paper, in ink taken from the palette.
 */
export const handwriting: LyricStyle = {
  id: 'handwriting',
  name: 'Handwriting',
  description: 'Each line written out by an animated pen.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Write',
  isNew: true,
  usesIcons: false,
  gradient: ['#1b1710', '#f4efe2'],
  palette: {
    accent: '#1f3a5f',
    text: '#232019',
    dim: 'rgba(35,32,25,0.3)',
    background: '#f6f1e4',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#f6f1e4';
    ctx.fillRect(0, 0, width, height);

    // Ruled paper.
    ctx.strokeStyle = 'rgba(60,90,140,0.12)';
    ctx.lineWidth = 1;
    const rule = Math.max(28, height / 12);
    for (let y = rule; y < height; y += rule) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(200,80,80,0.18)';
    ctx.beginPath();
    ctx.moveTo(width * 0.08, 0);
    ctx.lineTo(width * 0.08, height);
    ctx.stroke();

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      ctx.fillStyle = 'rgba(35,32,25,0.4)';
      ctx.font = fontOf(Math.min(22, width / 34), 500, FACE);
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? '♪' : 'Play a track to see lyrics', width / 2, height / 2);
      return;
    }

    const words = wordsOf(line);
    let size = Math.min(height * 0.11, width / 11);
    // The first layout has to measure at the size it will draw at, or a large
    // canvas packs the words together using tiny fallback metrics.
    ctx.font = fontOf(size, 500, FACE);
    let laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.34, width * 0.8, size);
    for (let attempt = 0; attempt < 6 && laid.rows.length > 2; attempt += 1) {
      size *= 0.84;
      ctx.font = fontOf(size, 500, FACE);
      laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.34, width * 0.8, size);
    }

    const lineHeight = size * 1.5;
    const top = height / 2 - (laid.rows.length * lineHeight) / 2 + lineHeight / 2;
    const amount = reveal(state.lineProgress);
    const totalWidth = Math.max(...laid.rowWidths, 1);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    laid.rows.forEach((row, rowIndex) => {
      const rowWidth = laid.rowWidths[rowIndex] ?? 0;
      let x = width / 2 - rowWidth / 2;
      const y = top + rowIndex * lineHeight;
      for (const item of row) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 4, y - size, item.width * amount, size * 2);
        ctx.clip();
        ctx.font = fontOf(size, 500, FACE);
        ctx.fillStyle = palette.accent;
        ctx.globalAlpha = 0.22;
        ctx.fillText(item.text, x + inkBleed(size), y + inkBleed(size));
        ctx.globalAlpha = 1;
        ctx.fillText(item.text, x, y);
        ctx.restore();
        x += item.width + size * 0.34;
      }
    });

    // The pen, while the line is still being written.
    if (writing(state.lineProgress)) {
      const pen = penAt(amount, totalWidth, state.activeIndex || 1);
      const penX = width / 2 - totalWidth / 2 + pen.x;
      const penY = top + pen.y;
      ctx.save();
      ctx.translate(penX, penY);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-1.5, 0, 3, size * 1.1);
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(-2.5, size * 1.1);
      ctx.lineTo(2.5, size * 1.1);
      ctx.lineTo(0, size * 1.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
};
