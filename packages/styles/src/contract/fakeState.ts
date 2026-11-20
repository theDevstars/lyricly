import type { LyricLine } from '../types';
import type { Palette, StyleState } from '../types';

const line = (
  text: string,
  words: { text: string; startMs: number; endMs: number }[],
  startMs: number,
): LyricLine => ({
  text,
  startMs,
  endMs: startMs + Math.max(1200, words.reduce((sum, word) => sum + (word.endMs - word.startMs), 0)),
  exact: true,
  words,
});

const timed = (text: string, startMs = 0, step = 320) => {
  let cursor = startMs;
  return text.split(' ').map((word) => {
    const item = { text: word, startMs: cursor, endMs: cursor + step };
    cursor += step;
    return item;
  });
};

const base = (overrides: Partial<StyleState> = {}): StyleState => ({
  lines: [],
  activeIndex: -1,
  lineProgress: 0,
  wordIndex: -1,
  wordProgress: 0,
  positionMs: 0,
  playing: true,
  track: { title: 'Sample', artist: 'Invented', app: 'Demo' },
  palette: {
    accent: '#ff5c8a',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.32)',
    background: '#0b0b10',
  } satisfies Palette,
  time: 1234,
  width: 1280,
  height: 720,
  ...overrides,
});

const fourtyWords = Array.from({ length: 40 }, (_, index) => `w${index}`).join(' ');

/** The states every style must survive. */
export const STATES: { name: string; state: StyleState }[] = [
  { name: 'empty', state: base() },
  {
    name: 'one word',
    state: base({
      lines: [line('hello', timed('hello'), 0)],
      activeIndex: 0,
      wordIndex: 0,
      lineProgress: 0.4,
      positionMs: 200,
    }),
  },
  {
    name: '40 words',
    state: base({
      lines: [line(fourtyWords, timed(fourtyWords, 0, 120), 0)],
      activeIndex: 0,
      wordIndex: 12,
      lineProgress: 0.3,
      positionMs: 1500,
    }),
  },
  {
    name: 'RTL',
    state: base({
      lines: [line('אני כאן', timed('אני כאן'), 0)],
      activeIndex: 0,
      wordIndex: 1,
      lineProgress: 0.5,
      positionMs: 400,
    }),
  },
  {
    name: 'CJK',
    state: base({
      lines: [line('夜の街を歩いて', timed('夜の街を歩いて'), 0)],
      activeIndex: 0,
      wordIndex: 0,
      lineProgress: 0.2,
      positionMs: 120,
    }),
  },
  {
    name: 'emoji',
    state: base({
      lines: [line('dance 💃 tonight 🌙', timed('dance 💃 tonight 🌙'), 0)],
      activeIndex: 0,
      wordIndex: 2,
      lineProgress: 0.6,
      positionMs: 700,
    }),
  },
  {
    name: 'estimated timing',
    state: base({
      lines: [
        { text: 'line synced only', startMs: 0, endMs: 3000, exact: false, words: [] },
        { text: 'second line', startMs: 3000, endMs: 6000, exact: false, words: [] },
      ],
      activeIndex: 0,
      wordIndex: -1,
      lineProgress: 0.3,
      positionMs: 900,
    }),
  },
  {
    name: 'instrumental gap',
    state: base({
      lines: [line('before the break', timed('before the break'), 0)],
      activeIndex: -1,
      wordIndex: -1,
      lineProgress: 0,
      positionMs: 90000,
    }),
  },
  {
    name: 'seek mid word',
    state: base({
      lines: [line('jump into the middle', timed('jump into the middle', 0, 400), 0)],
      activeIndex: 0,
      wordIndex: 2,
      wordProgress: 0.73,
      lineProgress: 0.68,
      positionMs: 1600,
    }),
  },
  {
    name: 'reduce motion on',
    state: base({
      lines: [line('still and calm', timed('still and calm'), 0)],
      activeIndex: 0,
      wordIndex: 1,
      lineProgress: 0.5,
      reduceMotion: true,
      photosensitive: true,
      positionMs: 500,
    }),
  },
  {
    name: 'long line on a short strip',
    state: base({
      lines: [line('a tiny window with a fairly long line of lyrics inside it', timed('a tiny window with a fairly long line of lyrics inside it'), 0)],
      activeIndex: 0,
      wordIndex: 3,
      lineProgress: 0.35,
      width: 760,
      height: 120,
      positionMs: 900,
    }),
  },
];
