import { describe, expect, it } from 'vitest';
import type { AudioView, LyricLine } from '../types';
import { energyOf, bandsOf } from './energy';

const lines: LyricLine[] = [
  {
    text: 'fast line here',
    startMs: 0,
    endMs: 900,
    exact: true,
    words: [
      { text: 'fast', startMs: 0, endMs: 150 },
      { text: 'line', startMs: 150, endMs: 300 },
      { text: 'here', startMs: 300, endMs: 450 },
    ],
  },
];

const audio = (overrides: Partial<AudioView> = {}): AudioView => ({
  active: true,
  level: 0.6,
  bass: 0.8,
  mid: 0.4,
  high: 0.2,
  beat: false,
  bpm: 120,
  bands: [0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0, 0, 0, 0, 0, 0, 0, 0],
  ...overrides,
});

describe('energyOf', () => {
  it('uses live audio when it is available', () => {
    const energy = energyOf({ lines, activeIndex: 0, positionMs: 100, audio: audio() });
    expect(energy.live).toBe(true);
    expect(energy.level).toBeGreaterThan(0.5);
    expect(energy.bpm).toBe(120);
  });

  it('takes the bpm from the audio device', () => {
    const energy = energyOf({ lines, activeIndex: 0, positionMs: 0, audio: audio({ bpm: 95 }) });
    expect(energy.bpm).toBe(95);
  });

  it('falls back to the lyrics when audio is inactive', () => {
    const energy = energyOf({
      lines,
      activeIndex: 0,
      positionMs: 100,
      audio: audio({ active: false }),
    });
    expect(energy.live).toBe(false);
    expect(energy.level).toBeGreaterThanOrEqual(0);
    expect(energy.level).toBeLessThanOrEqual(1);
  });

  it('falls back when there is no audio at all', () => {
    const energy = energyOf({ lines, activeIndex: 0, positionMs: 100 });
    expect(energy.live).toBe(false);
    expect(energy.pulse).toBeGreaterThanOrEqual(0);
    expect(energy.pulse).toBeLessThanOrEqual(1);
  });

  it('survives empty lyrics', () => {
    const energy = energyOf({ lines: [], activeIndex: -1, positionMs: 0 });
    expect(Number.isFinite(energy.level)).toBe(true);
    expect(Number.isFinite(energy.pulse)).toBe(true);
  });
});

describe('bandsOf', () => {
  it('returns the live bands when playing', () => {
    expect(bandsOf({ audio: audio() })).toHaveLength(16);
  });

  it('returns a flat line when silent', () => {
    const bands = bandsOf({ audio: audio({ active: false }) });
    expect(bands).toHaveLength(16);
    expect(bands.every((band) => band === 0)).toBe(true);
  });
});
