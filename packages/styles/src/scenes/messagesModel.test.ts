import { describe, expect, it } from 'vitest';
import type { LyricLine, LyricWord } from '../types';
import {
  phrasesOfLine,
  sideOf,
  splitPhrases,
  threadAt,
  timedWords,
  type PhraseWord,
} from './messagesModel';

const word = (text: string, startMs: number, endMs: number): PhraseWord => ({ text, startMs, endMs });

let clock = 0;
const line = (text: string, words?: string[]): LyricLine => {
  const parts = words ?? text.split(/\s+/).filter(Boolean);
  const start = clock;
  clock += parts.length * 500;
  const timed: LyricWord[] = parts.map((part, index) => ({
    text: part,
    startMs: start + index * 500,
    endMs: start + index * 500 + 400,
  }));
  return { text, startMs: start, endMs: start + parts.length * 500, exact: true, words: timed };
};

const lineAt = (text: string, startMs: number, step = 1000): LyricLine => {
  const parts = text.split(/\s+/).filter(Boolean);
  return {
    text,
    startMs,
    endMs: startMs + parts.length * step,
    exact: true,
    words: parts.map((part, index) => ({
      text: part,
      startMs: startMs + index * step,
      endMs: startMs + index * step + step - 100,
    })),
  };
};

describe('splitPhrases', () => {
  it('keeps a short line whole', () => {
    const chunks = splitPhrases([word('swim', 0, 100), word('home', 100, 200)]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].map((entry) => entry.text)).toEqual(['swim', 'home']);
  });

  it('caps phrases at six words', () => {
    const words = 'a b c d e f g h i j k l'.split(' ').map((text, index) => word(text, index * 100, index * 100 + 90));
    const chunks = splitPhrases(words);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(6);
  });

  it('splits at punctuation and folds away one-word orphans', () => {
    const words = [
      word('the', 0, 100),
      word('morning', 100, 200),
      word('comes,', 200, 300),
      word('and', 300, 400),
      word('then', 400, 500),
      word('the', 500, 600),
      word('rain', 600, 700),
    ];
    const chunks = splitPhrases(words);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeGreaterThan(1);
    expect(chunks[0].map((entry) => entry.text).join(' ')).toContain('morning comes,');
  });

  it('does not split inside quotes', () => {
    const words = [
      word('he', 0, 90),
      word('said', 90, 180),
      word('"hold', 180, 280),
      word('the', 280, 360),
      word('quiet', 360, 470),
      word('line"', 470, 560),
      word('and', 560, 650),
      word('left', 650, 740),
    ];
    const chunks = splitPhrases(words);
    const quoted = chunks.find((chunk) => chunk.some((entry) => entry.text.startsWith('"') && entry.text.length > 1));
    expect(quoted?.map((entry) => entry.text)).toContain('line"');
  });

  it('survives empty input', () => {
    expect(splitPhrases([])).toEqual([]);
  });
});

describe('sideOf', () => {
  it('is stable for the same track and alternates by group', () => {
    const first = sideOf('paper lanterns|the invented', 0);
    expect(sideOf('paper lanterns|the invented', 0)).toBe(first);
    expect(sideOf('paper lanterns|the invented', 1)).not.toBe(first);
    expect(sideOf('paper lanterns|the invented', 2)).toBe(first);
  });

  it('mirrors sides for right-to-left lines', () => {
    const ltr = sideOf('track', 0, false);
    expect(sideOf('track', 0, true)).not.toBe(ltr);
  });

  it('gives every phrase of one line the same side', () => {
    const entry = line('we drove all night through the rain and the neon signs again');
    const phrases = phrasesOfLine(entry, 3, 'seed', 3);
    expect(phrases.length).toBeGreaterThan(1);
    expect(new Set(phrases.map((phrase) => phrase.side)).size).toBe(1);
  });
});

describe('phrasesOfLine', () => {
  it('only the last phrase of a group carries the tail', () => {
    const phrases = phrasesOfLine(
      line('we drove all night through the rain and the neon signs again'),
      0,
      'seed',
      0,
    );
    expect(phrases.filter((phrase) => phrase.tail)).toHaveLength(1);
    expect(phrases[phrases.length - 1].tail).toBe(true);
  });

  it('estimates word times for line-synced lyrics', () => {
    const words = timedWords({ ...lineAt('one two three', 0), words: [] });
    expect(words).toHaveLength(3);
    expect(words[1].startMs).toBeGreaterThan(words[0].startMs);
  });

  it('splits a long unspaced CJK token into timed pieces', () => {
    const text = '雨の中を歩いて帰る途中で君のことを思い出していたよ';
    const entry: LyricLine = {
      text,
      startMs: 0,
      endMs: 4000,
      exact: true,
      words: [{ text, startMs: 0, endMs: 4000 }],
    };
    const words = timedWords(entry);
    expect(words.length).toBeGreaterThan(1);
    expect(words[words.length - 1].endMs).toBe(4000);
  });
});

describe('threadAt', () => {
  const track = 'paper lanterns|the invented';

  it('reveals only the words already sung', () => {
    const lines = [
      lineAt('every window holds a little sun', 0),
      lineAt('hold the quiet like a coin', 10000),
    ];
    const at = (positionMs: number) =>
      threadAt({ lines, activeIndex: 0, positionMs, playing: true, trackKey: track });

    expect(at(-1).items).toHaveLength(0);
    expect(at(0).items[0].revealed).toBe(1);
    expect(at(999).items[0].revealed).toBe(1);
    expect(at(1000).items[0].revealed).toBe(2);
    expect(at(4999).items[0].complete).toBe(false);
    expect(at(5000).items[0].complete).toBe(true);
    expect(at(5000).items[0].active).toBe(false);
  });

  it('shows no words from the next phrase', () => {
    const lines = [
      lineAt('we drove all night through the rain and the neon signs again', 0, 500),
      lineAt('and the radio played', 30000),
    ];
    const thread = threadAt({
      lines,
      activeIndex: 0,
      positionMs: 2000,
      playing: true,
      trackKey: track,
    });
    const last = thread.items[thread.items.length - 1];
    expect(last.phrase.words.slice(last.revealed).every((entry) => entry.startMs > 2000)).toBe(true);
  });

  it('emphasises the longest revealed word while typing and relaxes when done', () => {
    const lines = [lineAt('the extraordinary quiet', 0)];
    const mid = threadAt({ lines, activeIndex: 0, positionMs: 1500, playing: true, trackKey: track });
    const item = mid.items[0];
    expect(item.complete).toBe(false);
    expect(item.phrase.words[item.emphasis].text).toBe('extraordinary');

    const done = threadAt({ lines, activeIndex: 0, positionMs: 4000, playing: true, trackKey: track });
    expect(done.items[0].emphasis).toBe(-1);
  });

  it('keeps three line groups of history and trims the rest', () => {
    clock = 0;
    const lines = Array.from({ length: 12 }, (_, index) => lineAt(`line number ${index} here`, index * 6000));
    const thread = threadAt({
      lines,
      activeIndex: 11,
      positionMs: 11 * 6000 + 2000,
      playing: true,
      trackKey: track,
    });
    expect(thread.items.length).toBeGreaterThan(0);
    expect(Math.min(...thread.items.map((item) => item.phrase.lineIndex))).toBeGreaterThanOrEqual(8);
    expect(thread.items.every((item) => item.phrase.lineIndex <= 11)).toBe(true);
  });

  it('caps the thread at the requested item count', () => {
    clock = 0;
    const lines = Array.from({ length: 12 }, (_, index) => lineAt(`short line ${index}`, index * 4000));
    const thread = threadAt({
      lines,
      activeIndex: 11,
      positionMs: 11 * 4000 + 1500,
      playing: true,
      trackKey: track,
      maxItems: 4,
    });
    expect(thread.items).toHaveLength(4);
  });

  it('shows typing dots across a pause longer than 0.8s', () => {
    const lines = [lineAt('first line here', 0), lineAt('second line here', 9000)];
    const waiting = threadAt({ lines, activeIndex: 0, positionMs: 4000, playing: true, trackKey: track });
    expect(waiting.typing).toBe(true);
    expect(waiting.typingSide).toBe(sideOf(track, 1));

    const soon = threadAt({ lines, activeIndex: 0, positionMs: 8500, playing: true, trackKey: track });
    expect(soon.typing).toBe(false);
  });

  it('does not type while the current phrase is still being sung', () => {
    const lines = [lineAt('first line here', 0), lineAt('second line here', 9000)];
    const midPhrase = threadAt({ lines, activeIndex: 0, positionMs: 1200, playing: true, trackKey: track });
    expect(midPhrase.items.some((item) => item.active)).toBe(true);
    expect(midPhrase.typing).toBe(false);
  });

  it('does not type while paused', () => {
    const lines = [lineAt('first line here', 0), lineAt('second line here', 9000)];
    const paused = threadAt({ lines, activeIndex: 0, positionMs: 4000, playing: false, trackKey: track });
    expect(paused.typing).toBe(false);
  });

  it('shows typing dots during an instrumental line', () => {
    const lines = [
      lineAt('first line here', 0),
      { text: '♪', startMs: 9000, endMs: 14000, exact: false, words: [] },
    ];
    const thread = threadAt({ lines, activeIndex: 1, positionMs: 10000, playing: true, trackKey: track });
    expect(thread.typing).toBe(true);
  });

  it('is deterministic for a track and rebuilds the same thread on re-render', () => {
    clock = 0;
    const lines = Array.from({ length: 6 }, (_, index) => lineAt(`line ${index} of the song`, index * 5000));
    const input = { lines, activeIndex: 4, positionMs: 21000, playing: true, trackKey: track };
    const one = threadAt(input);
    const two = threadAt(input);
    expect(one).toEqual(two);
    expect(one.items.map((item) => item.phrase.side)).toEqual(two.items.map((item) => item.phrase.side));
  });

  it('handles empty, one-word, 40-word, emoji and RTL lines', () => {
    const cases: LyricLine[] = [
      { text: '', startMs: 0, endMs: 1000, exact: true, words: [] },
      lineAt('go', 0),
      lineAt(Array.from({ length: 40 }, (_, index) => `word${index}`).join(' '), 0, 100),
      lineAt('shine ✨ on 🌙 us', 0, 500),
      lineAt('אני הולך הביתה עכשיו', 0, 500),
    ];
    for (const entry of cases) {
      const thread = threadAt({
        lines: [entry],
        activeIndex: 0,
        positionMs: entry.startMs + 600,
        playing: true,
        trackKey: track,
      });
      expect(Array.isArray(thread.items)).toBe(true);
      for (const item of thread.items) {
        expect(item.revealed).toBeGreaterThan(0);
        expect(item.revealed).toBeLessThanOrEqual(item.phrase.words.length);
      }
    }
  });

  it('returns an empty thread before playback starts', () => {
    expect(threadAt({ lines: [], activeIndex: -1, positionMs: 0, playing: false, trackKey: track })).toEqual({
      items: [],
      typing: false,
      typingSide: 'in',
    });
  });
});
