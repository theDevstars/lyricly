import { describe, expect, it } from 'vitest';
import { STYLES } from '@lyrica/styles';
import { backgroundLuminance, sceneBlendFor, sceneLayerFor } from './sceneBlend';

describe('sceneBlendFor', () => {
  it('screens dark stages so their black drops out', () => {
    expect(sceneBlendFor('#000000')).toBe('screen');
    expect(sceneBlendFor('#050a10')).toBe('screen');
    expect(sceneBlendFor('#171410')).toBe('screen');
  });

  it('leaves light paper stages unblended, as a page on the planet', () => {
    expect(sceneBlendFor('#f6f1e4')).toBe('normal');
    expect(sceneBlendFor('#efe7d2')).toBe('normal');
    expect(sceneBlendFor('#ffffff')).toBe('normal');
    expect(sceneLayerFor('#f6f1e4')).toEqual({ blend: 'normal', inset: 0.05 });
    expect(sceneLayerFor('#050a10')).toEqual({ blend: 'screen', inset: 0 });
  });

  it('flips at the midpoint', () => {
    expect(sceneBlendFor('#7f7f7f')).toBe('screen');
    expect(sceneBlendFor('#808080')).toBe('normal');
  });

  it('reads short hex and ignores anything it cannot parse', () => {
    expect(sceneBlendFor('#fff')).toBe('normal');
    expect(sceneBlendFor('#000')).toBe('screen');
    expect(sceneBlendFor('rgba(0,0,0,0.5)')).toBe('screen');
    expect(sceneBlendFor(undefined)).toBe('screen');
    expect(backgroundLuminance('nope')).toBeNull();
  });

  it('gives every shipped style a blend, and keeps the light ones on multiply', () => {
    const blends = STYLES.map((style) => ({
      id: style.id,
      background: style.palette.background,
      blend: sceneBlendFor(style.palette.background),
    }));

    for (const entry of blends) expect(['screen', 'normal']).toContain(entry.blend);

    const light = blends.filter((entry) => (backgroundLuminance(entry.background) ?? 0) >= 0.5);
    expect(light.length).toBeGreaterThan(0);
    for (const entry of light) expect(entry.blend).toBe('normal');

    // The two paper styles are the reason the mode exists; keep them honest.
    expect(blends.find((entry) => entry.id === 'handwriting')?.blend).toBe('normal');
    expect(blends.find((entry) => entry.id === 'typewriter')?.blend).toBe('normal');
    expect(blends.find((entry) => entry.id === 'ship')?.blend).toBe('screen');
  });
});
