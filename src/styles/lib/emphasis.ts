import type { LyricLine } from '../../types';

export interface Emphasis {
  /** 0..1, how much the word should be emphasised. */
  weight: number;
  held: boolean;
  repeated: boolean;
}

const stripPunctuation = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Scores a word for emphasis: long words, held words (sung much longer than
 * their neighbours), shouted words and words the singer repeats. Pure.
 */
export function emphasisOf(
  word: { text: string; startMs: number; endMs: number },
  context: { medianDurationMs: number; wordIndex: number; words: { text: string }[] },
): Emphasis {
  const duration = Math.max(1, word.endMs - word.startMs);
  const held = context.medianDurationMs > 0 && duration > context.medianDurationMs * 1.8;
  const clean = stripPunctuation(word.text);

  const repeated =
    clean.length > 2 &&
    context.words.some(
      (other, index) => index !== context.wordIndex && stripPunctuation(other.text) === clean,
    );

  const shouted = word.text === word.text.toUpperCase() && /[A-Z]/.test(word.text);
  const long = clean.length >= 9;

  let weight = 0;
  if (held) weight += 0.45;
  if (repeated) weight += 0.3;
  if (shouted) weight += 0.15;
  if (long) weight += 0.1;
  if (word.text.endsWith('!')) weight += 0.1;

  return { weight: Math.min(1, weight), held, repeated };
}

/** Median word duration on a line, the baseline for "held". */
export function medianDuration(words: { startMs: number; endMs: number }[]): number {
  if (words.length === 0) return 0;
  const spans = words.map((word) => Math.max(1, word.endMs - word.startMs)).sort((a, b) => a - b);
  const mid = spans.length >> 1;
  return spans.length % 2 === 0 ? (spans[mid - 1] + spans[mid]) / 2 : spans[mid];
}

/** Scores for every word on a line, in order. */
export function lineEmphasis(line: LyricLine): Emphasis[] {
  const median = medianDuration(line.words);
  return line.words.map((word, wordIndex) =>
    emphasisOf(word, { medianDurationMs: median, wordIndex, words: line.words }),
  );
}

/** A word repeated from an earlier line ("oh oh oh" choruses). */
export function lineRepeats(text: string, lines: LyricLine[], index: number): boolean {
  const key = text.trim().toLowerCase();
  if (key.length < 3) return false;
  return lines.some((line, other) => other !== index && line.text.trim().toLowerCase() === key);
}
