import { describe, expect, it } from 'vitest';
import type { LyricLine } from '../types';
import { emphasisOf, lineEmphasis, medianDuration } from './emphasis';

const word = (text: string, start: number, end: number) => ({ text, startMs: start, endMs: end });

describe('medianDuration', () => {
  it('is the middle span', () => {
    expect(medianDuration([word('a', 0, 100), word('b', 100, 300), word('c', 300, 900)])).toBe(200);
  });

  it('averages the middle pair for even counts', () => {
    expect(medianDuration([word('a', 0, 100), word('b', 0, 300)])).toBe(200);
  });

  it('is zero for no words', () => {
    expect(medianDuration([])).toBe(0);
  });
});

describe('emphasisOf', () => {
  it('marks a held word', () => {
    const result = emphasisOf(word('stay', 0, 900), {
      medianDurationMs: 200,
      wordIndex: 0,
      words: [word('stay', 0, 900)],
    });
    expect(result.held).toBe(true);
    expect(result.weight).toBeGreaterThan(0.3);
  });

  it('marks a repeated word', () => {
    const result = emphasisOf(word('higher', 0, 200), {
      medianDurationMs: 200,
      wordIndex: 0,
      words: [word('higher', 0, 200), word('higher', 200, 400)],
    });
    expect(result.repeated).toBe(true);
  });

  it('stays low for a plain short word', () => {
    const result = emphasisOf(word('and', 0, 180), {
      medianDurationMs: 200,
      wordIndex: 0,
      words: [word('and', 0, 180)],
    });
    expect(result.weight).toBeLessThan(0.3);
  });

  it('scores every word on a line', () => {
    const line: LyricLine = {
      text: 'hold me now',
      startMs: 0,
      endMs: 2300,
      exact: true,
      words: [word('hold', 0, 2000), word('me', 2000, 2100), word('now', 2100, 2200)],
    };
    const scores = lineEmphasis(line);
    expect(scores).toHaveLength(3);
    expect(scores[0].held).toBe(true);
    expect(scores[0].weight).toBeGreaterThan(scores[1].weight);
  });
});
