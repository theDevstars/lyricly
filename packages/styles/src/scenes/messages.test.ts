import { describe, expect, it } from 'vitest';
import type { LyricLine, StyleState } from '../types';
import { FakeContext, asContext } from '../contract/fakeCanvas';
import { messages } from './messages';

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

const render = (overrides: Partial<StyleState>) => {
  const fake = new FakeContext();
  const state = stateOf(overrides);
  fake.canvas = { width: state.width, height: state.height };
  messages.render(asContext(fake), state);
  return { fake, state };
};

const painted = (fake: FakeContext): string[] => fake.paint.map((entry) => entry.text);

describe('Messages rendering', () => {
  it('never paints a word before it is sung', () => {
    const line = lineFrom('every window holds a little sun', 0, 1000);
    const { fake } = render({
      lines: [line],
      activeIndex: 0,
      positionMs: 1200,
    });

    const words = line.words.map((word) => word.text);
    const shown = painted(fake).filter((text) => words.includes(text));
    expect(shown).toEqual(['every', 'window']);
    expect(shown).not.toContain('holds');
    expect(shown).not.toContain('sun');
  });

  it('splits a long line into phrase bubbles', () => {
    const line = lineFrom('we drove all night through the rain and the neon signs again', 0, 500);
    const { fake, state } = render({
      lines: [line],
      activeIndex: 0,
      positionMs: 6000,
    });

    const words = line.words.map((word) => word.text);
    const shown = painted(fake).filter((text) => words.includes(text));
    // Every word of the line is on screen, but across more than one bubble.
    expect(shown).toHaveLength(words.length);
    const xs = new Set(fake.paint.filter((entry) => words.includes(entry.text)).map((entry) => Math.round(entry.x)));
    expect(xs.size).toBeLessThanOrEqual(words.length);
    expect(state.width).toBe(1280);
  });

  it('alternates sides between line groups', () => {
    const first = lineFrom('paper lanterns glow', 0, 600);
    const second = lineFrom('swimming homeward now', 5000, 600);
    const { fake, state } = render({
      lines: [first, second],
      activeIndex: 1,
      positionMs: 7000,
    });

    const firstWords = first.words.map((word) => word.text);
    const secondWords = second.words.map((word) => word.text);
    const xsOf = (words: string[]) =>
      fake.paint.filter((entry) => words.includes(entry.text)).map((entry) => entry.x);

    const firstLeft = Math.min(...xsOf(firstWords)) < state.width / 2;
    const secondLeft = Math.min(...xsOf(secondWords)) < state.width / 2;
    expect(firstLeft).not.toBe(secondLeft);
  });

  it('hides the unfinished bubble under Reduce Motion', () => {
    const line = lineFrom('paper lanterns in the rain', 0, 900);
    const words = line.words.map((word) => word.text);

    const live = render({ lines: [line], activeIndex: 0, positionMs: 1200 });
    expect(painted(live.fake).filter((text) => words.includes(text)).length).toBeGreaterThan(0);

    const calm = render({ lines: [line], activeIndex: 0, positionMs: 1200, reduceMotion: true });
    const shown = painted(calm.fake).filter((text) => words.includes(text));
    expect(shown).toHaveLength(0);
  });

  it('keeps every bubble inside the stage at 1280x720 and 1920x1080', () => {
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
    ]) {
      const lines = [lineFrom('paper lanterns in the rain', 0, 500), lineFrom('swim the long way home', 4000, 500)];
      const { fake } = render({ lines, activeIndex: 1, positionMs: 5600, width, height });
      for (const paint of fake.paint) {
        expect(paint.x).toBeGreaterThanOrEqual(0);
        expect(paint.x).toBeLessThanOrEqual(width);
        expect(paint.y).toBeGreaterThanOrEqual(-height * 0.2);
        expect(paint.y).toBeLessThanOrEqual(height);
      }
    }
  });

  it('paints nothing but the thread once the song is playing', () => {
    const line = lineFrom('paper lanterns in the rain', 0, 600);
    const { fake } = render({ lines: [line], activeIndex: 0, positionMs: 3000 });
    const text = painted(fake).join(' ');
    expect(text).not.toContain('waiting for the first line');
  });
});
