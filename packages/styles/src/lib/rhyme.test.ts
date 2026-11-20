import { describe, expect, it } from 'vitest';
import { rhymeGroups, rhymeKey, rhymes } from './rhyme';

describe('rhymeKey', () => {
  it('keeps the last vowel run and what follows', () => {
    expect(rhymeKey('harbour')).toBe('our');
    expect(rhymeKey('down')).toBe('own');
    expect(rhymeKey('promise')).toBe('e');
  });

  it('ignores punctuation and case', () => {
    expect(rhymeKey('Down!')).toBe(rhymeKey('down'));
  });

  it('is empty for single letters', () => {
    expect(rhymeKey('a')).toBe('');
  });
});

describe('rhymes', () => {
  it('matches words with the same tail', () => {
    expect(rhymes('sound', 'ground')).toBe(true);
    expect(rhymes('light', 'night')).toBe(true);
  });

  it('rejects unrelated words', () => {
    expect(rhymes('harbour', 'constellation')).toBe(false);
  });

  it('is false when either word has no rhyme tail', () => {
    expect(rhymes('a', 'b')).toBe(false);
  });
});

describe('rhymeGroups', () => {
  it('puts rhyming words in the same family', () => {
    const groups = rhymeGroups(['light', 'sound', 'night', 'ground']);
    expect(groups[0]).toBe(groups[2]);
    expect(groups[1]).toBe(groups[3]);
    expect(groups[0]).not.toBe(groups[1]);
  });

  it('marks unusable words with -1', () => {
    expect(rhymeGroups(['a'])[0]).toBe(-1);
  });
});
