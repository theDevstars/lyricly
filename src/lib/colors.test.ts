import { describe, expect, it } from 'vitest';
import type { Palette } from '@lyrica/styles';
import type { Settings } from '../types';
import { contrastRatio, paletteFromArt, parseHex, resolvePalette, withAlpha } from './colors';

const base: Palette = {
  accent: '#E2B24A',
  text: '#F3E7C4',
  dim: 'rgba(243,231,196,0.55)',
  background: '#050403',
};

const settings = (patch: Partial<Settings> = {}): Settings =>
  ({
    colorAutoSync: true,
    colorText: '',
    colorHighlight: '',
    colorSecondary: '',
    ...patch,
  }) as Settings;

const BLACK = { r: 0, g: 0, b: 0 };

describe('paletteFromArt', () => {
  it('lifts an AA cream and a readable accent out of the cover', () => {
    const palette = paletteFromArt({ accent: '#8a3b12', dominant: '#3b2a18' }, base);
    const text = parseHex(palette.text);
    const accent = parseHex(palette.accent);
    expect(text && contrastRatio(text, BLACK)).toBeGreaterThanOrEqual(4.5);
    expect(accent && contrastRatio(accent, BLACK)).toBeGreaterThanOrEqual(3);
    expect(palette.dim).toContain('rgba(');
    expect(palette.background).toBe(base.background);
  });

  it('always survives a dark cover', () => {
    for (const accent of ['#000000', '#101010', '#2b1a00', '#3a3a3a']) {
      const palette = paletteFromArt({ accent, dominant: accent }, base);
      const text = parseHex(palette.text);
      expect(text && contrastRatio(text, BLACK), accent).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the base palette when the art is not a hex colour', () => {
    expect(paletteFromArt({ accent: 'nope', dominant: 'nope' }, base)).toEqual(base);
  });
});

describe('resolvePalette', () => {
  const art = { accent: '#C98A3E', dominant: '#E9D9B4' };

  it('uses the cover under Auto Sync', () => {
    const palette = resolvePalette(base, settings(), art);
    expect(palette).not.toEqual(base);
    expect(palette.text).not.toBe(base.text);
  });

  it('falls back to the style palette with no cover', () => {
    expect(resolvePalette(base, settings(), null)).toEqual(base);
  });

  it('lets the manual wells win when Auto Sync is off', () => {
    const palette = resolvePalette(
      base,
      settings({ colorAutoSync: false, colorText: '#ffffff', colorHighlight: '#00ff88' }),
      art,
    );
    expect(palette.text).toBe('#ffffff');
    expect(palette.accent).toBe('#00ff88');
    expect(palette.dim).toBe(base.dim);
  });
});

describe('withAlpha', () => {
  it('turns hex into rgba', () => {
    expect(withAlpha('#ffcc00', 0.5)).toBe('rgba(255,204,0,0.5)');
  });
});
