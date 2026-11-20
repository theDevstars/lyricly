import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, layoutWords, wordsOf } from '../../lib/text';
import { peel, wallFor } from './model';

const COLORS = ['#f6e27a', '#f5b6cd', '#b7e4c7', '#bcd9f5', '#f4c99b'];

/**
 * Sticky Notes — every line lands on a wall as a taped note with a random tilt,
 * and older notes peel away as the song moves on.
 */
export const stickyNotes: LyricStyle = {
  id: 'sticky-notes',
  name: 'Sticky Notes',
  description: 'Each line stuck to the wall, then peeled away.',
  group: 'native',
  eyebrow: 'Native Design',
  sample: 'note',
  isNew: true,
  usesIcons: false,
  gradient: ['#2a2416', '#f6e27a'],
  palette: {
    accent: '#f6e27a',
    text: '#22201a',
    dim: 'rgba(34,32,26,0.35)',
    background: '#171410',
  },

  render(ctx, state) {
    const { width, height } = state;
    const wall = ctx.createLinearGradient(0, 0, 0, height);
    wall.addColorStop(0, '#171410');
    wall.addColorStop(1, '#0d0b08');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);

    if (!activeLine(state.lines, state.activeIndex)) {
      placeholder(ctx, state);
      return;
    }

    const notes = wallFor(state.activeIndex, width, height, 4);
    const base = Math.min(height * 0.055, width / 22);

    notes.forEach((note) => {
      const line = state.lines[note.lineIndex];
      if (!line) return;
      const active = note.lineIndex === state.activeIndex;
      const noteWidth = width * (active ? 0.42 : 0.3);
      const noteHeight = noteWidth * 0.62;
      const lift = peel(note.life) * height * 0.06;

      ctx.save();
      ctx.translate(note.x, note.y - lift);
      ctx.rotate(note.tilt + (active ? 0 : peel(note.life) * 0.2));
      ctx.globalAlpha = active ? 1 : 0.45 + note.life * 0.4;

      // Paper and shadow.
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = active ? 24 : 12;
      ctx.fillStyle = COLORS[Math.abs(note.lineIndex) % COLORS.length];
      ctx.fillRect(-noteWidth / 2, -noteHeight / 2, noteWidth, noteHeight);
      ctx.shadowBlur = 0;

      // Tape.
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-noteWidth * 0.12, -noteHeight / 2 - 6, noteWidth * 0.24, 12);

      // Text.
      const words = wordsOf(line);
      const size = base * (active ? 0.9 : 0.7);
      const laid = layoutWords(words, (text) => ctx.measureText(text).width, size * 0.3, noteWidth * 0.84, size);
      ctx.font = fontOf(size, 600);
      ctx.fillStyle = '#22201a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      laid.rows.slice(0, 5).forEach((row, rowIndex) => {
        const text = row.map((item) => item.text).join(' ');
        const y = -noteHeight / 2 + noteHeight * 0.3 + rowIndex * size * 1.25;
        ctx.fillText(text, 0, y);
      });
      ctx.restore();
    });
  },
};
