import type { StyleState } from '../types';

export interface Energy {
  /** 0..1: how busy the current stretch of the song is. */
  level: number;
  /** 0..1 saw wave for beat-synced motion. */
  pulse: number;
  /** Beats per minute estimated from word onsets, clamped to something sane. */
  bpm: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The app has no audio analysis, so energy is read from the lyrics themselves:
 * short words in quick succession mean a busy section. Deterministic and cheap.
 */
export function energyOf(state: Pick<StyleState, 'lines' | 'activeIndex' | 'positionMs'>): Energy {
  const lines = state.lines;
  const index = state.activeIndex;
  const window: number[] = [];

  for (let offset = -1; offset <= 2; offset += 1) {
    const line = lines[index + offset];
    if (!line) continue;
    for (const word of line.words) {
      window.push(Math.max(60, word.endMs - word.startMs));
    }
  }

  const average = window.length
    ? window.reduce((sum, span) => sum + span, 0) / window.length
    : 700;

  // 160 ms per word is frantic, 1200 ms is a ballad.
  const level = clamp01((1200 - average) / 900);
  const bpm = Math.round(Math.min(168, Math.max(76, 60000 / Math.max(220, average * 2))));
  const beatMs = 60000 / bpm;
  const pulse = ((state.positionMs % beatMs) + beatMs) % beatMs / beatMs;

  return { level, pulse, bpm };
}

/** A smooth 0..1..0 bump for a beat pulse. */
export const beatBump = (pulse: number): number => Math.sin(clamp01(1 - pulse) * Math.PI);

/** Simple beat grid phase for styles that animate on the beat. */
export function beatPhase(positionMs: number, bpm: number): number {
  const beat = 60000 / Math.max(40, bpm);
  return ((positionMs % beat) + beat) / beat;
}
