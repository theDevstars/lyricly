import { describe, expect, it } from 'vitest';
import type { LyricLine } from '../types';
import { detectSections, repeats, sectionLabel, verseRange, isLabelLine } from './sections';

const line = (text: string, start = 0): LyricLine => ({
  text,
  startMs: start,
  endMs: start + 2000,
  exact: false,
  words: [],
});

describe('sectionLabel', () => {
  it('reads square and round bracket labels', () => {
    expect(sectionLabel('[Chorus]')).toBe('Chorus');
    expect(sectionLabel('[verse 2]')).toBe('Verse 2');
    expect(sectionLabel('(Bridge)')).toBe('Bridge');
    expect(sectionLabel('[Pre-Chorus]')).toBe('Pre-Chorus');
  });

  it('ignores ordinary lyrics', () => {
    expect(sectionLabel('we drove past the harbour')).toBeNull();
    expect(sectionLabel('')).toBeNull();
  });
});

describe('detectSections', () => {
  it('assigns a label to every line after it', () => {
    const sections = detectSections([line('[Verse]'), line('a'), line('b'), line('[Chorus]'), line('c')]);
    expect(sections.map((entry) => entry.label)).toEqual(['Verse', 'Verse', 'Verse', 'Chorus', 'Chorus']);
    expect(sections[3].chorus).toBe(true);
  });

  it('copes with no labels at all', () => {
    const sections = detectSections([line('a'), line('b')]);
    expect(sections).toHaveLength(2);
    expect(sections.every((entry) => entry.label === '')).toBe(true);
  });

  it('ignores lines that only look like tags', () => {
    expect(isLabelLine(line('[Chorus]'))).toBe(true);
    expect(isLabelLine(line('chorus of birds'))).toBe(false);
  });
});

describe('repeats', () => {
  it('collapses repeated chorus lines after the first', () => {
    const marks = repeats([line('hold on'), line('something else'), line('Hold on!')]);
    expect(marks[0].collapsed).toBe(false);
    expect(marks[0].count).toBe(2);
    expect(marks[2].collapsed).toBe(true);
  });

  it('leaves unique lines alone', () => {
    expect(repeats([line('one'), line('two')]).every((mark) => mark.count === 1)).toBe(true);
  });
});

describe('verseRange', () => {
  it('finds the run between blank lines', () => {
    const lines = [line('a'), line('b'), line(''), line('c'), line('d')];
    expect(verseRange(lines, 0)).toEqual([0, 1]);
    expect(verseRange(lines, 4)).toEqual([3, 4]);
  });

  it('stops at section labels', () => {
    const lines = [line('a'), line('[Chorus]'), line('c')];
    expect(verseRange(lines, 0)).toEqual([0, 0]);
    expect(verseRange(lines, 2)).toEqual([2, 2]);
  });

  it('handles empty lyrics', () => {
    expect(verseRange([], 0)).toEqual([0, -1]);
  });
});
