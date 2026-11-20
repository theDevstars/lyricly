/** Height of the waveform at x, from the lyric-derived energy. */
export function waveAt(x: number, timeMs: number, level: number, width: number): number {
  const base = 0.18 + level * 0.5;
  const slow = Math.sin((x / Math.max(1, width)) * Math.PI * 6 + timeMs / 700);
  const fast = Math.sin((x / Math.max(1, width)) * Math.PI * 17 - timeMs / 240);
  return (slow * 0.7 + fast * 0.3) * base;
}

/** Vertical bounce of a word while the bass is loud. */
export const bounce = (wordIndex: number, level: number, pulse: number): number =>
  Math.sin(wordIndex * 1.7 + pulse * Math.PI * 2) * (2 + level * 10);

/** Words stretch with the bass. */
export const stretch = (level: number, pulse: number): number => 1 + level * 0.06 * Math.sin(pulse * Math.PI);
