import type { LyricLine } from '../types';
import { wordsOf } from '../lib/text';

/**
 * The Messages style, minus the canvas: phrases, sides, grouping and the word
 * reveal. Kept pure so the timing rules can be tested without drawing.
 */

export type Side = 'in' | 'out';

export interface PhraseWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Phrase {
  /** Stable across renders: track-independent line and phrase position. */
  id: string;
  lineIndex: number;
  phraseIndex: number;
  side: Side;
  words: PhraseWord[];
  text: string;
  startMs: number;
  endMs: number;
  /** Only the last phrase of a line group carries a tail. */
  tail: boolean;
  rtl: boolean;
}

export interface ThreadItem {
  phrase: Phrase;
  /** How many words have been sung so far. */
  revealed: number;
  /** True while the phrase is still being sung (ring on). */
  active: boolean;
  complete: boolean;
  /** Index of the emphasised (longest) revealed word, or -1. */
  emphasis: number;
}

export interface Thread {
  items: ThreadItem[];
  typing: boolean;
  typingSide: Side;
}

export interface ThreadInput {
  lines: LyricLine[];
  activeIndex: number;
  positionMs: number;
  playing: boolean;
  /** Title and artist; seeds the side rhythm. */
  trackKey: string;
  /** Newest items kept for drawing. */
  maxItems?: number;
  /** Line groups of history kept before the current one. */
  lookbackGroups?: number;
  /** Silence before a phrase that shows the typing dots. */
  typingDelayMs?: number;
}

const MAX_WORDS = 6;
const MAX_CHARS = 40;
const BREAK_AFTER = /[.,!?;:…]["'”’)\]]?$/;
const QUOTE = /["'“”‘’]/g;
const INSTRUMENTAL = /^[♪♫\s]*$/;

const isRtlText = (text: string): boolean => /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0780-\u07bf]/.test(text);

/** FNV-1a: a stable number for a track, so its sides never flicker. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/**
 * Which side a line group sits on. Deterministic per track, and consecutive
 * groups alternate; RTL mirror the whole thread.
 */
export function sideOf(seed: string, groupIndex: number, rtl = false): Side {
  const first = hash(seed) % 2 === 0 ? 'out' : 'in';
  const flipped = (groupIndex % 2 === 0) === (first === 'out');
  const side: Side = flipped ? 'out' : 'in';
  if (!rtl) return side;
  return side === 'in' ? 'out' : 'in';
}

/** Splits a long unspaced token (CJK, chat-speak) into timed pieces. */
function explode(word: PhraseWord): PhraseWord[] {
  if (word.text.length <= 24 || /\s/.test(word.text)) return [word];
  const pieces: PhraseWord[] = [];
  const span = Math.max(1, word.endMs - word.startMs);
  const size = 12;
  const count = Math.ceil(word.text.length / size);
  for (let index = 0; index < count; index += 1) {
    pieces.push({
      text: word.text.slice(index * size, (index + 1) * size),
      startMs: Math.round(word.startMs + (span * index) / count),
      endMs: Math.round(word.startMs + (span * (index + 1)) / count),
    });
  }
  return pieces;
}

/** Timed words for a line, estimating badly timed or missing word times. */
export function timedWords(line: LyricLine): PhraseWord[] {
  const words = wordsOf(line).flatMap((word) =>
    explode({ text: word.text, startMs: word.startMs, endMs: word.endMs }),
  );
  return words.filter((word) => word.text.trim().length > 0);
}

/**
 * Breaks a line into chat-sized phrases: at punctuation and breath points, at
 * most six words or forty characters, never leaving a single-word orphan and
 * never splitting inside quotes.
 */
export function splitPhrases(words: PhraseWord[]): PhraseWord[][] {
  const chunks: PhraseWord[][] = [];
  let current: PhraseWord[] = [];

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push(current);
      current = [];
    }
  };

  words.forEach((word, index) => {
    current.push(word);
    const next = words[index + 1];
    if (!next) return;

    const text = current.map((entry) => entry.text).join(' ');
    const insideQuotes = (text.match(QUOTE) ?? []).length % 2 === 1;
    if (insideQuotes) return;

    const endsClause = BREAK_AFTER.test(word.text);
    const wouldOverflow =
      current.length >= MAX_WORDS || text.length + 1 + next.text.length > MAX_CHARS;
    if (endsClause || wouldOverflow) flush();
  });
  flush();

  // A single word on its own reads like a typo; fold it into a neighbour.
  for (let index = 0; index < chunks.length && chunks.length > 1; index += 1) {
    if (chunks[index].length !== 1) continue;
    const target = index > 0 ? index - 1 : index + 1;
    const [orphan] = chunks.splice(index, 1);
    const into = chunks[target === index ? index : target > index ? target - 1 : target];
    if (target > index) into.unshift(...orphan);
    else into.push(...orphan);
    index = Math.max(-1, target - 1);
  }

  return chunks;
}

/** All phrases of one line, with sides and the group's tail flag. */
export function phrasesOfLine(
  line: LyricLine,
  lineIndex: number,
  seed: string,
  groupIndex: number,
): Phrase[] {
  const rtl = isRtlText(line.text);
  const words = timedWords(line);
  const chunks = splitPhrases(words);
  const side = sideOf(seed, groupIndex, rtl);

  return chunks.map((chunk, phraseIndex) => {
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    return {
      id: `${lineIndex}:${phraseIndex}`,
      lineIndex,
      phraseIndex,
      side,
      words: chunk,
      text: chunk.map((word) => word.text).join(' '),
      startMs: first.startMs,
      endMs: last.endMs,
      tail: phraseIndex === chunks.length - 1,
      rtl,
    };
  });
}

/** How far ahead of its timestamp a word waits as a ghost. */
export const GHOST_LEAD_MS = 150;
/** A pop never gives up sooner than this, so fast delivery stays readable. */
export const MIN_HOLD_MS = 180;
/** Words closer than this drop the ghost and use a shorter, tighter pop. */
export const FAST_WORD_MS = 90;
/** A word sung for longer than this keeps pulsing while it is active. */
export const HELD_WORD_MS = 700;

export type WordPhase = 'hidden' | 'ghost' | 'active' | 'settled';

export interface WordTiming {
  startMs: number;
  endMs: number;
}

export interface WordState {
  phase: WordPhase;
  /** Milliseconds from the ghost appearing to the word being sung. */
  leadMs: number;
  /** When the pop lets go and the word settles. */
  settleAtMs: number;
  /** Words delivered in a burst: no ghost, tighter pop. */
  fast: boolean;
  /** Long word: the pop keeps pulsing until it ends. */
  held: boolean;
}

/**
 * The three-phase word animation, derived from the playhead alone so seeks,
 * pauses and resumes always land on the right phase.
 *
 * hidden -> ghost (lead window) -> active (start .. settle) -> settled.
 * A word settles when the next one starts or when it ends, whichever comes
 * first, but never before a minimum hold.
 */
export function wordState(
  playhead: number,
  word: WordTiming,
  prevWord?: WordTiming,
  nextWord?: WordTiming,
): WordState {
  const duration = Math.max(0, word.endMs - word.startMs);
  const prevDuration = prevWord ? Math.max(0, prevWord.endMs - prevWord.startMs) : 0;
  const fast = prevWord ? word.startMs - prevWord.startMs < FAST_WORD_MS : false;
  const held = duration > HELD_WORD_MS;

  const leadMs = fast
    ? 0
    : prevWord
      ? Math.min(GHOST_LEAD_MS, prevDuration * 0.5)
      : GHOST_LEAD_MS;

  const ghostFromMs = fast
    ? word.startMs
    : Math.max(prevWord?.startMs ?? -Infinity, word.startMs - leadMs);

  const naturalEnd = Math.min(
    nextWord ? nextWord.startMs : Infinity,
    word.endMs > word.startMs ? word.endMs : word.startMs + MIN_HOLD_MS,
  );
  const settleAtMs = Math.max(word.startMs + MIN_HOLD_MS, naturalEnd);

  const phase: WordPhase =
    playhead < ghostFromMs
      ? 'hidden'
      : playhead < word.startMs
        ? 'ghost'
        : playhead < settleAtMs
          ? 'active'
          : 'settled';

  return { phase, leadMs, settleAtMs, fast, held };
}

const longestWord = (phrase: Phrase, revealed: number): number => {
  let best = -1;
  let bestLength = -1;
  for (let index = 0; index < revealed; index += 1) {
    const length = phrase.words[index].text.length;
    if (length >= bestLength) {
      best = index;
      bestLength = length;
    }
  }
  return best;
};

/** The thread as it should look at this instant. */
export function threadAt(input: ThreadInput): Thread {
  const {
    lines,
    activeIndex,
    positionMs,
    playing,
    trackKey,
    maxItems = 12,
    lookbackGroups = 3,
    typingDelayMs = 800,
  } = input;

  const seed = trackKey || 'lyrica';
  if (!Number.isFinite(activeIndex) || activeIndex < 0 || lines.length === 0) {
    return { items: [], typing: false, typingSide: 'in' };
  }

  const current = Math.min(activeIndex, lines.length - 1);
  const from = Math.max(0, current - lookbackGroups);

  const phrases: Phrase[] = [];
  for (let index = from; index <= current; index += 1) {
    const line = lines[index];
    if (!line) continue;
    phrases.push(...phrasesOfLine(line, index, seed, index));
  }

  const items: ThreadItem[] = [];
  for (const phrase of phrases) {
    let revealed = 0;
    for (const word of phrase.words) {
      if (word.startMs <= positionMs) revealed += 1;
      else break;
    }
    // A phrase appears a beat early so its first word can ghost in.
    if (revealed === 0 && positionMs < phrase.words[0].startMs - GHOST_LEAD_MS) continue;
    const complete = revealed === phrase.words.length;
    items.push({
      phrase,
      revealed,
      complete,
      active: !complete,
      emphasis: complete ? -1 : longestWord(phrase, revealed),
    });
  }

  const trimmed = items.slice(Math.max(0, items.length - maxItems));

  // The next phrase, for the typing indicator: either later on this line or the
  // first phrase of the following line.
  const upcoming: Phrase[] = [];
  const currentLine = lines[current];
  if (currentLine) {
    upcoming.push(...phrasesOfLine(currentLine, current, seed, current));
  }
  const nextLine = lines[current + 1];
  if (nextLine) {
    upcoming.push(...phrasesOfLine(nextLine, current + 1, seed, current + 1));
  }
  const next = upcoming.find((phrase) => phrase.startMs > positionMs);

  const instrumental = currentLine ? INSTRUMENTAL.test(currentLine.text.trim()) : false;
  const gap = next ? next.startMs - positionMs : Infinity;
  // Dots only when nothing is being typed right now: the phrase on screen has
  // finished and the next one is still a beat away.
  const busy = items.some((item) => item.active);
  const typing =
    playing && !busy && (instrumental || (next !== undefined && gap > typingDelayMs));

  return {
    items: trimmed,
    typing,
    typingSide: next?.side ?? sideOf(seed, current, currentLine ? isRtlText(currentLine.text) : false),
  };
}
