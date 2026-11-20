import type { LyricLine } from '../types';

export interface Section {
  /** "Verse", "Chorus", "Bridge", or "" when the lyrics carry no labels. */
  label: string;
  /** Index into the original lines array. */
  lineIndex: number;
  /** Chorus lines repeat through the song. */
  chorus: boolean;
}

const TAG = /^\s*[[(]\s*(verse|chorus|bridge|intro|outro|hook|pre-?chorus|refrain|break)\s*(\d+)?\s*[\])]\s*$/i;

/** A section label on its own line, e.g. "[Chorus 2]". */
export function sectionLabel(text: string): string | null {
  const match = TAG.exec(text);
  if (!match) return null;
  const raw = match[1].toLowerCase().replace(/-/g, '');
  const number = match[2] ?? '';
  const named: Record<string, string> = {
    verse: 'Verse',
    chorus: 'Chorus',
    bridge: 'Bridge',
    intro: 'Intro',
    outro: 'Outro',
    hook: 'Hook',
    prechorus: 'Pre-Chorus',
    refrain: 'Refrain',
    break: 'Break',
  };
  return `${named[raw] ?? raw}${number ? ` ${number}` : ''}`;
}

/**
 * Groups lines into sections. Uses explicit labels when present, otherwise blank
 * lines, and falls back to one section for the whole song. Pure and tested.
 */
export function detectSections(lines: LyricLine[]): Section[] {
  const out: Section[] = [];
  let current = '';
  let index = 0;

  for (const line of lines) {
    const label = sectionLabel(line.text);
    if (label) {
      current = label;
      out.push({ label, lineIndex: index, chorus: /chorus|hook|refrain/i.test(label) });
      index += 1;
      continue;
    }
    out.push({ label: current, lineIndex: index, chorus: /chorus|hook|refrain/i.test(current) });
    index += 1;
  }

  return out;
}

/** Normalised line text, for comparing repeats. */
export const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export interface Repeat {
  count: number;
  /** True for every line of a repeated group after the first. */
  collapsed: boolean;
}

/** Chorus lines that come back later, so a layout can print "x2" instead. */
export function repeats(lines: LyricLine[]): Repeat[] {
  const seen = new Map<string, number>();
  for (const line of lines) {
    const key = normalise(line.text);
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const printed = new Set<string>();
  return lines.map((line) => {
    const key = normalise(line.text);
    const count = seen.get(key) ?? 1;
    if (!key || count < 2) return { count: 1, collapsed: false };
    if (!printed.has(key)) {
      printed.add(key);
      return { count, collapsed: false };
    }
    return { count, collapsed: true };
  });
}

/** The verse that holds the given line: a run between blank lines or labels. */
export function verseRange(lines: LyricLine[], lineIndex: number): [number, number] {
  if (lines.length === 0) return [0, -1];
  let start = Math.max(0, lineIndex);
  let end = Math.min(lines.length - 1, lineIndex);

  while (start > 0 && !sectionLabel(lines[start - 1].text) && lines[start - 1].text.trim() !== '') {
    start -= 1;
  }
  if (start > 0) start = Math.max(0, start);
  while (
    end < lines.length - 1 &&
    !sectionLabel(lines[end + 1].text) &&
    lines[end + 1].text.trim() !== ''
  ) {
    end += 1;
  }

  return [start, end];
}

/** True when the line is only a label, so a lyric layout should skip it. */
export const isLabelLine = (line: LyricLine): boolean => sectionLabel(line.text) !== null;
