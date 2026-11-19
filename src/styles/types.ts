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

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
