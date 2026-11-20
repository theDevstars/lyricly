/**
 * Neon brightness for a tube. Flicker is capped below 3 Hz for photosensitivity:
 * the pattern repeats every 700 ms and only ever dips, it never strobes.
 */
export function tubeBrightness(timeMs: number, index: number, lineIndex: number, photosensitive: boolean): number {
  if (photosensitive) return 1;
  const phase = (timeMs + index * 90 + lineIndex * 40) % 700;
  if (phase < 40) return 0.55;
  if (phase < 70) return 0.85;
  return 1;
}

/** The line burns in over the first moments, tube by tube. */
export const ignite = (lineProgress: number, wordIndex: number, wordCount: number): number => {
  const perWord = 1 / Math.max(4, wordCount);
  return Math.min(1, Math.max(0, (lineProgress - wordIndex * perWord * 0.6) / 0.08));
};

/** Reflection strength under the sign. */
export const reflection = (height: number): number => Math.max(0.08, Math.min(0.3, height / 4000));
