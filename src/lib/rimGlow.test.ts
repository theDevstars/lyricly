import { describe, expect, it } from 'vitest';
import { rimIntensity, rimSides } from './rimGlow';

describe('rimSides', () => {
  it('runs the light along four edges when there is no cutout', () => {
    const sides = rimSides({ width: 1280, height: 720, inset: 6 });
    expect(sides.top).toEqual([
      { x: 6, y: 6 },
      { x: 1274, y: 6 },
    ]);
    expect(sides.right[sides.right.length - 1]).toEqual({ x: 1274, y: 714 });
    expect(sides.bottom[0]).toEqual({ x: 1274, y: 714 });
    expect(sides.left[sides.left.length - 1]).toEqual({ x: 6, y: 6 });
  });

  it('dips into the cutout with rounded corners', () => {
    const sides = rimSides({
      width: 1280,
      height: 720,
      inset: 6,
      cutout: { width: 300, height: 34 },
    });
    const deepest = Math.max(...sides.top.map((point) => point.y));
    expect(deepest).toBeCloseTo(40, 5);
    expect(sides.top[0]).toEqual({ x: 6, y: 6 });
    expect(sides.top[sides.top.length - 1]).toEqual({ x: 1274, y: 6 });
    // The notch is centred: the lowest points straddle x = 640.
    const lowest = sides.top.filter((point) => Math.abs(point.y - deepest) < 0.01);
    const centre = lowest.reduce((sum, point) => sum + point.x, 0) / lowest.length;
    expect(centre).toBeCloseTo(640, 0);
  });

  it('keeps the notch inside the screen on narrow windows', () => {
    const sides = rimSides({
      width: 320,
      height: 200,
      inset: 6,
      cutout: { width: 900, height: 60 },
    });
    sides.top.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(6);
      expect(point.x).toBeLessThanOrEqual(314);
    });
    expect(Math.max(...sides.top.map((point) => point.y))).toBeLessThan(200 * 0.4 + 6);
  });
});

describe('rimIntensity', () => {
  const base = { beat: false, glow: 0.6, animation: 'breathe', reduceMotion: false };

  it('breathes slowly and lifts on a beat', () => {
    const idle = rimIntensity(0, base);
    const beat = rimIntensity(0, { ...base, beat: true });
    expect(beat).toBeGreaterThan(idle);
    expect(rimIntensity(0, { ...base, animation: 'still' })).toBeCloseTo(idle, 5);
  });

  it('stays calm under Reduce Motion', () => {
    const still = rimIntensity(0, { ...base, reduceMotion: true });
    expect(still).toBeLessThanOrEqual(1);
    expect(still).toBeCloseTo(rimIntensity(4000, { ...base, reduceMotion: true }), 5);
  });
});
