import { describe, expect, it } from 'vitest';
import type { Palette } from '../../types';
import {
  constellationColors,
  contrastOnBlack,
  creamFromArt,
  ensureContrast,
  rgba,
} from './palette';

const warmBase: Palette = {
  accent: '#E2B24A',
  text: '#F3E7C4',
  dim: 'rgba(243,231,196,0.55)',
  background: '#050403',
};

describe('constellation palette', () => {
  it('is warm cream on black by default', () => {
    const colors = constellationColors(warmBase, 'warm');
    expect(colors.background).toBe('#050403');
    expect(colors.text).toBe('#F3E7C4');
    expect(colors.label).toContain('0.55');
    expect(colors.line).toContain('0.45');
    expect(colors.halo).toContain('0.18');
    expect(contrastOnBlack(colors.text)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnBlack(colors.bright)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the cool silver-lavender variant', () => {
    const colors = constellationColors(warmBase, 'cool');
    expect(colors.background).toBe('#04060f');
    expect(colors.text).toBe('#c9ccff');
    expect(colors.bright).toBe('#ffffff');
  });

  it('follows the manual colour wells through the resolved palette', () => {
    const manual: Palette = { ...warmBase, text: '#ffd9a0', accent: '#ff9d00' };
    const colors = constellationColors(manual, 'warm');
    expect(colors.text).toBe(ensureContrast('#ffd9a0', 4.5));
    expect(colors.halo).toContain('rgba(255,');
  });

  it('keeps an album-art cream readable against black', () => {
    const random = mulberry32Art();
    for (let sample = 0; sample < 200; sample += 1) {
      const hex = `#${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}`;
      const cream = creamFromArt(hex);
      expect(contrastOnBlack(cream), hex).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('builds rgba strings with a clamped alpha', () => {
    expect(rgba('#ffffff', 0.5)).toBe('rgba(255,255,255,0.5)');
    expect(rgba('#000000', 2)).toBe('rgba(0,0,0,1)');
  });
});

function mulberry32Art(): () => number {
  let state = 1234567;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
