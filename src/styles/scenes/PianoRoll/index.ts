import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf, wordsOf } from '../../lib/text';
import { barsFor, proximity } from './model';

/**
 * Piano Roll — every word is a falling note bar whose length is its duration,
 * reaching the now line at the moment it is sung.
 */
export const pianoRoll: LyricStyle = {
  id: 'piano-roll',
  name: 'Piano Roll',
  description: 'Words ride falling note bars like a rhythm game.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: '♪ ♩ ♫',
  isNew: true,
  defaultEffects: ['beat', 'particles'],
  usesIcons: false,
  gradient: ['#0a0618', '#8fd3ff'],
  palette: {
    accent: '#8fd3ff',
    text: '#eef7ff',
    dim: 'rgba(238,247,255,0.28)',
    background: '#080513',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#080513';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state);
      return;
    }

    const words = wordsOf(line);
    const nowY = height * 0.84;
    const gutter = width * 0.06;
    const laneWidth = (width - gutter * 2) / Math.max(1, words.length);
    const bars = barsFor(words, state.positionMs, laneWidth, height * 0.7, nowY);
    const size = Math.min(laneWidth * 0.36, height * 0.035);

    // Lanes and the now line.
    ctx.strokeStyle = 'rgba(143,211,255,0.08)';
    for (let index = 0; index <= words.length; index += 1) {
      const x = gutter + index * laneWidth;
      ctx.beginPath();
      ctx.moveTo(x, height * 0.08);
      ctx.lineTo(x, nowY);
      ctx.stroke();
    }

    for (const bar of bars) {
      if (bar.y + bar.height < 0 || bar.y > height) continue;
      const near = proximity(bar, nowY);
      ctx.save();
      ctx.globalAlpha = bar.active ? 1 : 0.55 + near * 0.4;
      ctx.fillStyle = bar.active ? palette.accent : 'rgba(143,211,255,0.35)';
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = bar.active ? 18 : near * 10;
      const x = gutter + bar.x + (laneWidth - bar.width) / 2;
      ctx.fillRect(x, bar.y, bar.width, bar.height);
      ctx.restore();

      // The word rides on the bar.
      ctx.fillStyle = bar.active ? '#08121f' : palette.text;
      ctx.font = fontOf(size, bar.active ? 800 : 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (bar.height > size * 1.4) {
        ctx.fillText(words[bar.wordIndex].text, x + bar.width / 2, bar.y + bar.height - size * 0.9);
      }
    }

    // The now line, and the keyboard rail beneath it.
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gutter, nowY);
    ctx.lineTo(width - gutter, nowY);
    ctx.stroke();

    for (let index = 0; index < 24; index += 1) {
      const x = gutter + (index / 24) * (width - gutter * 2);
      ctx.fillStyle = index % 7 === 0 ? 'rgba(143,211,255,0.5)' : 'rgba(143,211,255,0.16)';
      ctx.fillRect(x, nowY, (width - gutter * 2) / 24 - 1, index % 7 === 0 ? 10 : 5);
    }
  },
};
