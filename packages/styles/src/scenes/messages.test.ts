import { describe, expect, it } from 'vitest';
import type { LyricLine, StyleState } from '../types';
import { FakeContext, asContext } from '../contract/fakeCanvas';
import { messages } from './messages';
import { wordState } from './messagesModel';

const lineFrom = (text: string, startMs: number, step = 900): LyricLine => {
  const parts = text.split(/\s+/).filter(Boolean);
  return {
    text,
    startMs,
    endMs: startMs + parts.length * step,
    exact: true,
    words: parts.map((part, index) => ({
      text: part,
      startMs: startMs + index * step,
      endMs: startMs + index * step + step - 100,
    })),
  };
};

const stateOf = (overrides: Partial<StyleState>): StyleState =>
  ({
    lines: [],
    activeIndex: 0,
    lineProgress: 0,
    wordIndex: 0,
    wordProgress: 0,
    positionMs: 0,
    playing: true,
    track: { title: 'Paper Lanterns', artist: 'The Invented', app: 'Demo' },
    palette: messages.palette,
    time: 1000,
    width: 1280,
    height: 720,
    ...overrides,
  }) as StyleState;

/**
 * The fake canvas ignores transforms, but the words are drawn inside
 * translate/scale, so track them here to see where the glyphs really land.
 */
function tracked(fake: FakeContext): CanvasRenderingContext2D {
  let tx = 0;
  let ty = 0;
  let sx = 1;
  let sy = 1;
  const stack: [number, number, number, number][] = [];

  const proxy = new Proxy(fake, {
    get(target, prop) {
      if (prop === 'translate') return (x: number, y: number) => {
        tx += x * sx;
        ty += y * sy;
      };
      if (prop === 'scale') return (x: number, y: number) => {
        sx *= x;
        sy *= y;
      };
      if (prop === 'save') return () => stack.push([tx, ty, sx, sy]);
      if (prop === 'restore') return () => {
        const saved = stack.pop();
        if (saved) [tx, ty, sx, sy] = saved;
      };
      if (prop === 'fillText') return (text: string, x: number, y: number) => {
        fake.calls += 1;
        fake.paint.push({ text, x: tx + x * sx, y: ty + y * sy });
      };
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) {
      Reflect.set(target, prop, value);
      return true;
    },
  });

  return asContext(proxy as unknown as FakeContext);
}

const render = (overrides: Partial<StyleState>) => {
  const fake = new FakeContext();
  const state = stateOf(overrides);
  fake.canvas = { width: state.width, height: state.height };
  messages.render(tracked(fake), state);
  return { fake, state };
};

const painted = (fake: FakeContext): string[] => fake.paint.map((entry) => entry.text);

/** One entry per drawn glyph position: the weight crossfade draws twice. */
const uniquePaint = (fake: FakeContext) => {
  const seen = new Map<string, { text: string; x: number; y: number }>();
  for (const entry of fake.paint) {
    seen.set(`${entry.text}@${entry.x.toFixed(1)},${entry.y.toFixed(1)}`, entry);
  }
  return [...seen.values()];
};

describe('Messages rendering', () => {
  it('never paints a word beyond the ghost', () => {
    const line = lineFrom('every window holds a little sun', 0, 1000);
    const { fake } = render({ lines: [line], activeIndex: 0, positionMs: 1200 });

    const words = line.words.map((word) => word.text);
    const shown = painted(fake).filter((text) => words.includes(text));
    expect(shown).toContain('every');
    expect(shown).toContain('window');
    expect(shown).not.toContain('holds');
    expect(shown).not.toContain('sun');
  });

  it('shows exactly one ghost just before the next word', () => {
    const line = lineFrom('every window holds a little sun', 0, 1000);
    const { fake } = render({ lines: [line], activeIndex: 0, positionMs: 1950 });

    const words = line.words.map((word) => word.text);
    const shown = painted(fake).filter((text) => words.includes(text));
    expect(shown).toContain('holds');
    expect(shown).not.toContain('little');
    expect(shown).not.toContain('sun');
  });

  it('keeps the bubble at its final size regardless of the playhead', () => {
    const line = lineFrom('we drove all night through the rain', 0, 600);
    const samples = [0, 300, 900, 1800, 3000, 6000].map(
      (positionMs) => render({ lines: [line], activeIndex: 0, positionMs }).fake,
    );

    // Horizontal layout never moves: the bubble is pre-sized to the phrase.
    const columns = new Map<string, number>();
    for (const paint of uniquePaint(samples[samples.length - 1])) {
      if (paint.text.includes('Today')) continue;
      columns.set(paint.text, paint.x);
    }
    for (const fake of samples) {
      for (const paint of uniquePaint(fake)) {
        const column = columns.get(paint.text);
        if (column === undefined) continue;
        expect(paint.x).toBeCloseTo(column, 1);
      }
    }

    // Once settled, every word sits on the same baseline.
    const settled = uniquePaint(samples[samples.length - 1]).filter(
      (paint) => !paint.text.includes('Today'),
    );
    const baseline = settled[0].y;
    for (const paint of settled) expect(paint.y).toBeCloseTo(baseline, 1);
  });

  it('splits a long line into phrase bubbles', () => {
    const line = lineFrom('we drove all night through the rain and the neon signs again', 0, 500);
    const { fake } = render({ lines: [line], activeIndex: 0, positionMs: 6000 });

    const words = line.words.map((word) => word.text);
    const shown = uniquePaint(fake)
      .map((entry) => entry.text)
      .filter((text) => words.includes(text));
    expect(shown).toHaveLength(words.length);
  });

  it('alternates sides between line groups', () => {
    const first = lineFrom('paper lanterns glow', 0, 600);
    const second = lineFrom('swimming homeward now', 5000, 600);
    const { fake, state } = render({
      lines: [first, second],
      activeIndex: 1,
      positionMs: 7000,
    });

    const xs = (line: LyricLine) => {
      const words = line.words.map((word) => word.text);
      return uniquePaint(fake)
        .filter((entry) => words.includes(entry.text))
        .map((entry) => entry.x);
    };

    const firstLeft = Math.min(...xs(first)) < state.width / 2;
    const secondLeft = Math.min(...xs(second)) < state.width / 2;
    expect(firstLeft).not.toBe(secondLeft);
  });

  it('hides the unfinished bubble under Reduce Motion', () => {
    const line = lineFrom('paper lanterns in the rain', 0, 900);
    const words = line.words.map((word) => word.text);

    const live = render({ lines: [line], activeIndex: 0, positionMs: 1200 });
    expect(painted(live.fake).filter((text) => words.includes(text)).length).toBeGreaterThan(0);

    const calm = render({ lines: [line], activeIndex: 0, positionMs: 1200, reduceMotion: true });
    expect(painted(calm.fake).filter((text) => words.includes(text))).toHaveLength(0);
  });

  it('keeps every bubble inside the stage at 1280x720 and 1920x1080', () => {
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
    ]) {
      const lines = [
        lineFrom('paper lanterns in the rain', 0, 500),
        lineFrom('swim the long way home', 4000, 500),
      ];
      const { fake } = render({ lines, activeIndex: 1, positionMs: 5600, width, height });
      for (const paint of fake.paint) {
        expect(paint.x).toBeGreaterThanOrEqual(0);
        expect(paint.x).toBeLessThanOrEqual(width);
        expect(paint.y).toBeGreaterThanOrEqual(-height * 0.2);
        expect(paint.y).toBeLessThanOrEqual(height);
      }
    }
  });

  it('walks one phrase through ghost, pop and settle with no layout drift', () => {
    const phrase = "And it's not his fault you kick";
    const line = lineFrom(phrase, 0, 420);
    const words = line.words;
    const pause = 700;

    let popped = 0;
    let ghosted = 0;
    const reference = new Map<string, { x: number; y: number }>();

    for (let positionMs = 0; positionMs <= words[words.length - 1].startMs + pause; positionMs += 50) {
      const { fake } = render({ lines: [line], activeIndex: 0, positionMs });
      const phases = words.map((word, index) =>
        wordState(positionMs, word, words[index - 1], words[index + 1]).phase,
      );

      const active = phases.filter((phase) => phase === 'active').length;
      const ghost = phases.filter((phase) => phase === 'ghost').length;
      expect(active).toBeLessThanOrEqual(1);
      expect(ghost).toBeLessThanOrEqual(1);
      popped = Math.max(popped, active);
      ghosted = Math.max(ghosted, ghost);

      // Nothing past the ghost may be visible.
      const lastVisible = phases.reduce((best, phase, index) => (phase === 'hidden' ? best : index), -1);
      expect(phases.slice(lastVisible + 1).every((phase) => phase === 'hidden')).toBe(true);

      // Only visible words are painted.
      const shown = uniquePaint(fake).map((entry) => entry.text);
      phases.forEach((phase, index) => {
        if (phase === 'hidden') expect(shown).not.toContain(words[index].text);
      });

      // Every word keeps its reserved column: no reflow as neighbours pop.
      for (const paint of uniquePaint(fake)) {
        const known = reference.get(paint.text);
        if (known) expect(paint.x).toBeCloseTo(known.x, 1);
        else reference.set(paint.text, { x: paint.x, y: paint.y });
      }
    }

    expect(popped).toBe(1);
    expect(ghosted).toBe(1);
  });
});
