import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { fontOf, isRtl, wordsOf } from '../../lib/text';
import { verseRange } from '../../lib/sections';
import { compose } from './model';

/**
 * Poster Collage — a verse becomes a typographic poster in mixed sizes and
 * weights, rebuilt verse by verse, with the sung word pulled forward.
 */
export const posterCollage: LyricStyle = {
  id: 'poster-collage',
  name: 'Poster Collage',
  description: 'Words stack into a typographic poster, rebuilt every verse.',
  group: 'kinetic',
  eyebrow: 'Kinetic type',
  sample: 'Poster',
  isNew: true,
  defaultEffects: ['rhyme'],
  usesIcons: false,
  gradient: ['#1b1408', '#e8e0cd'],
  palette: {
    accent: '#d9482a',
    text: '#f5efe2',
    dim: 'rgba(245,239,226,0.35)',
    background: '#141008',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#141008';
    ctx.fillRect(0, 0, width, height);

    if (state.activeIndex < 0) {
      placeholder(ctx, state);
      return;
    }

    const [start, end] = verseRange(state.lines, state.activeIndex);
    const verseLines = state.lines.slice(start, end + 1).filter((line) => line.text.trim() !== '');
    if (verseLines.length === 0) {
      placeholder(ctx, state);
      return;
    }

    const texts = verseLines.flatMap((line) => (line.words.length ? line.words.map((word) => word.text) : line.text.split(/\s+/))).slice(0, 24);
    const seed = texts.join('').length * 7919 + start * 104729;
    const layout = compose(texts, seed);
    const base = Math.min(height * 0.075, width / 16);

    // Paper.
    ctx.fillStyle = 'rgba(232,224,205,0.04)';
    ctx.fillRect(width * 0.04, height * 0.05, width * 0.92, height * 0.9);

    let word = 0;
    verseLines.forEach((line, lineOffset) => {
      const lineIndex = start + lineOffset;
      const isActive = lineIndex === state.activeIndex;
      const lineWords = line.words.length ? line.words : wordsOf(line);
      lineWords.forEach((entry) => {
        const place = layout[word];
        word += 1;
        if (!place) return;
        const sung = isActive && entry.startMs <= state.positionMs;
        const active = isActive && entry.startMs <= state.positionMs && entry.endMs > state.positionMs;

        ctx.save();
        ctx.translate(place.x * width, place.y * height);
        ctx.rotate(isActive ? 0 : (place.x - 0.5) * 0.06);
        ctx.font = `${place.italic ? 'italic ' : ''}${fontOf(base * place.scale, place.weight)}`;
        ctx.textAlign = isRtl(entry.text) ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = active ? palette.accent : sung ? palette.text : 'rgba(245,239,226,0.42)';
        if (active) {
          ctx.shadowColor = palette.accent;
          ctx.shadowBlur = 12;
        }
        ctx.fillText(entry.text, 0, 0);
        ctx.restore();
      });
    });
  },
};
