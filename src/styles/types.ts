import type { LyricLine } from '../types';

export interface Palette {
  accent: string;
  text: string;
  dim: string;
  background: string;
}

export interface StyleTrack {
  title: string;
  artist: string;
  app: string;
}

export interface StyleState {
  lines: LyricLine[];
  /** Index of the line being sung, -1 when between lines. */
  activeIndex: number;
  /** 0..1 through the active line. */
  lineProgress: number;
  /** Index of the active word inside the active line, -1 when none. */
  wordIndex: number;
  /** 0..1 through the active word. */
  wordProgress: number;
  /** Nudged playback position. */
  positionMs: number;
  playing: boolean;
  track: StyleTrack;
  palette: Palette;
  /** Milliseconds since the stage started, for ambient motion. */
  time: number;
  width: number;
  height: number;
}

export type StyleGroup = 'kinetic' | 'scenes';

export interface LyricStyle {
  id: string;
  name: string;
  description: string;
  group: StyleGroup;
  palette: Palette;
  /** Gallery thumbnail gradient. */
  gradient: [string, string];
  usesIcons: boolean;
  render(ctx: CanvasRenderingContext2D, state: StyleState): void;
}

export interface FlatWord {
  text: string;
  startMs: number;
  endMs: number;
  lineIndex: number;
  wordIndex: number;
}

export function flattenWords(lines: LyricLine[]): FlatWord[] {
  const out: FlatWord[] = [];
  lines.forEach((line, lineIndex) => {
    line.words.forEach((word, wordIndex) => {
      out.push({
        text: word.text,
        startMs: word.startMs,
        endMs: word.endMs,
        lineIndex,
        wordIndex,
      });
    });
  });
  return out;
}

const UNSPACED_RANGES: [number, number][] = [
  [0x0e00, 0x0e7f], // Thai
  [0x0e80, 0x0eff], // Lao
  [0x1000, 0x109f], // Myanmar
  [0x1780, 0x17ff], // Khmer
  [0x3040, 0x30ff], // Hiragana and Katakana
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0x20000, 0x2fa1f],
];

/** True for scripts that are written without spaces between words. */
const isUnspacedScript = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  return UNSPACED_RANGES.some(([low, high]) => code >= low && code <= high);
};

/**
 * Gap between two neighbouring word tokens. Words inside an unspaced-script
 * run are single characters and must not be spread apart.
 */
export const wordGap = (previous: string, next: string, fallback: number): number =>
  isUnspacedScript(previous.slice(-1)) && isUnspacedScript(next.slice(0, 1)) ? 0 : fallback;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
