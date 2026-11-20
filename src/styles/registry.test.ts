import { describe, expect, it } from 'vitest';
import { GROUPS, STYLES, stylesIn } from './registry';

const NEW_IDS = [
  'karaoke-sweep',
  'liquid-type',
  'gravity-drop',
  'orbit',
  'tunnel',
  'poster-collage',
  'waveform-words',
  'neon-sign',
  'typewriter',
  'handwriting',
  'glitch-vhs',
  'terminal',
  'piano-roll',
  'subtitle-cinema',
  'group-chat',
  'native-stories',
  'sticky-notes',
  'context-window',
  'full-verse',
  'lyric-wall',
  'echo-trail',
  'backing-layer',
  'sections',
  'multi-language',
  'dual-screen-split',
  'mini-strip',
];

describe('registry', () => {
  it('has unique ids', () => {
    const ids = STYLES.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('registers every new style exactly once', () => {
    for (const id of NEW_IDS) {
      expect(STYLES.filter((style) => style.id === id), id).toHaveLength(1);
    }
  });

  it('gives every new style a tile sample and an eyebrow', () => {
    for (const id of NEW_IDS) {
      const style = STYLES.find((entry) => entry.id === id);
      expect(style?.sample, `${id} sample`).toBeTruthy();
      expect(style?.eyebrow, `${id} eyebrow`).toBeTruthy();
      expect(style?.isNew, `${id} new chip`).toBe(true);
    }
  });

  it('places every style in a gallery group', () => {
    const grouped = GROUPS.flatMap((group) => stylesIn(group.id));
    expect(grouped).toHaveLength(STYLES.length);
  });

  it('keeps the four gallery groups', () => {
    expect(GROUPS.map((group) => group.id)).toEqual(['kinetic', 'scenes', 'native', 'lyrics']);
  });

  it('gives each new style its own gradient', () => {
    const gradients = NEW_IDS.map((id) => {
      const style = STYLES.find((entry) => entry.id === id);
      return `${style?.gradient[0]}-${style?.gradient[1]}`;
    });
    expect(new Set(gradients).size).toBe(NEW_IDS.length);
  });

  it('uses the requested gallery descriptions', () => {
    expect(STYLES.find((style) => style.id === 'karaoke-sweep')?.description).toBe(
      "Each word fills with color at the exact moment it's sung.",
    );
    expect(STYLES.find((style) => style.id === 'mini-strip')?.description).toBe(
      'A tiny always-on-top line for when you are busy.',
    );
  });
});
