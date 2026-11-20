import type { LyricStyle } from '../../types';
import { backdrop, placeholder } from '../../lib/draw';
import { activeLine, fontOf, wordsOf } from '../../lib/text';
import { seedFrom, scatter } from '../../lib/physics';
import { advance, bodiesFor, floorAt } from './model';
import type { Body } from '../../lib/physics';

interface Cache {
  key: string;
  bodies: Body[];
  lastTime: number;
  scattered: boolean;
}

let cache: Cache | null = null;

/**
 * Gravity Drop — words fall, bounce and pile on the floor, then are thrown away
 * when the line ends. One deterministic seed per line keeps replays identical.
 */
export const gravityDrop: LyricStyle = {
  id: 'gravity-drop',
  name: 'Gravity Drop',
  description: 'Words fall into a pile, then scatter when the line ends.',
  group: 'kinetic',
  eyebrow: 'Kinetic type',
  sample: 'Drop',
  isNew: true,
  usesIcons: false,
  gradient: ['#1a0b02', '#ffb020'],
  palette: {
    accent: '#ffb020',
    text: '#fff3d6',
    dim: 'rgba(255,243,214,0.3)',
    background: '#0d0601',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    backdrop(ctx, width, height, '#0d0601', '#1d0d03');

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      cache = null;
      placeholder(ctx, state);
      return;
    }

    const size = Math.min(height * 0.075, width / 16);
    ctx.font = fontOf(size, 700);
    const words = wordsOf(line);
    const key = `${state.activeIndex}:${line.text}`;

    if (!cache || cache.key !== key) {
      cache = {
        key,
        bodies: bodiesFor(
          words.map((word) => word.text),
          words.map((word) => ctx.measureText(word.text).width + size * 0.6),
          width,
          height,
          seedFrom(line.text),
        ),
        lastTime: state.time,
        scattered: false,
      };
    }

    const dt = Math.max(0, Math.min(48, state.time - cache.lastTime));
    cache.lastTime = state.time;
    advance(cache.bodies, dt, height, width);

    if (state.wordIndex >= 0) {
      for (const body of cache.bodies) {
        if (body.wordIndex <= state.wordIndex && !body.grounded && body.vy === 0) {
          // A sung word starts falling at once; the rest follow the vocal.
          body.vy = 0.35;
        }
      }
    }

    // Past the line, the pile is thrown away.
    if (state.lineProgress > 0.94 && !cache.scattered) {
      scatter(cache.bodies, seedFrom(key));
      cache.scattered = true;
    }

    for (const body of cache.bodies) {
      if (body.y > height + 120) continue;
      const sung = body.wordIndex <= state.wordIndex;
      ctx.save();
      ctx.translate(body.x + body.width / 2, body.y + body.height / 2);
      ctx.rotate(body.rotation);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = sung ? palette.text : palette.dim;
      if (body.wordIndex === state.wordIndex) {
        ctx.fillStyle = palette.accent;
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 16;
      }
      ctx.fillText(body.text, 0, 0);
      ctx.restore();
    }

    // The floor, so the pile reads as a pile.
    const floor = floorAt(height);
    const paint = ctx.createLinearGradient(0, floor, 0, height);
    paint.addColorStop(0, 'rgba(255,176,32,0.16)');
    paint.addColorStop(1, 'rgba(255,176,32,0)');
    ctx.fillStyle = paint;
    ctx.fillRect(0, floor, width, height - floor);
  },
};
