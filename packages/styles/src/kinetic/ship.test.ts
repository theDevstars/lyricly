import { describe, expect, it } from 'vitest';
import { fitFont } from './ship';

// A stand-in for measureText: wide letters are 1 em, narrow ones 0.5 em.
const measureAt = (fontPx: number) => (text: string) => {
  const units = [...text].reduce((sum, char) => sum + (/[mwMW]/.test(char) ? 1 : 0.5), 0);
  return units * fontPx;
};

describe('fitFont', () => {
  it('leaves short words alone', () => {
    const measure = measureAt(34);
    expect(fitFont(measure, 'go', 34, 200)).toBe(34);
  });

  it('shrinks a long word until it fits its column', () => {
    const measure = measureAt(34);
    const limit = 200;
    // "mammothly" measures 221px at 34px, over the 200px cell.
    const font = fitFont(measure, 'mammothly', 34, limit);
    expect(font).toBeLessThan(34);
    expect(measureAt(font)('mammothly')).toBeLessThanOrEqual(limit + 0.001);
  });

  it('never goes below the floor', () => {
    const measure = measureAt(34);
    const font = fitFont(measure, 'mmmmmmmmmmmmmmmm', 34, 100, 10);
    expect(font).toBe(10);
  });

  it('tolerates empty words and broken measurements', () => {
    expect(fitFont(() => 0, '', 34, 200)).toBe(34);
    expect(fitFont(() => Number.NaN, 'x', 34, 200)).toBe(34);
  });
});
