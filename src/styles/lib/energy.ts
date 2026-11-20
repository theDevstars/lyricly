import type { StyleState } from '../types';

export interface Energy {
  /** 0..1: how busy the song is right now. */
  level: number;
  /** 0..1 saw wave for beat-synced motion. */
  pulse: number;
  /** Beats per minute; estimated from lyrics when audio is unavailable. */
  bpm: number;
  /** True when the numbers came from the audio device, not the lyrics. */
  live: boolean;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Energy for the animated styles. Real loopback audio wins when it is available
 * and audible; otherwise the lyrics themselves are a decent stand-in (short
 * words in quick succession mean a busy section).
 */
export function energyOf(
  state: Pick<StyleState, 'lines' | 'activeIndex' | 'positionMs' | 'audio'>,
): Energy {
  const audio = state.audio;
  if (audio?.active) {
    const level = clamp01(audio.level * 0.45 + audio.bass * 0.75);
    const bpm = audio.bpm > 40 ? audio.bpm : 100;
    const beatMs = 60000 / Math.max(40, bpm);
    const pulse = (((state.positionMs % beatMs) + beatMs) % beatMs) / beatMs;
    return { level, pulse, bpm, live: true };
  }

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
  const pulse = (((state.positionMs % beatMs) + beatMs) % beatMs) / beatMs;

  return { level, pulse, bpm, live: false };
}

/** A smooth 0..1..0 bump for a beat pulse. */
export const beatBump = (pulse: number): number => Math.sin(clamp01(1 - pulse) * Math.PI);

/** Simple beat grid phase for styles that animate on the beat. */
export function beatPhase(positionMs: number, bpm: number): number {
  const beat = 60000 / Math.max(40, bpm);
  return ((positionMs % beat) + beat) / beat;
}

/** The live band levels, or a flat line when nothing is playing. */
export function bandsOf(state: Pick<StyleState, 'audio'>, count = 16): number[] {
  const bands = state.audio?.bands ?? [];
  if (state.audio?.active && bands.length > 1) return bands;
  return new Array(count).fill(0);
}
