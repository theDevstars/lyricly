/** Extra size a word gets while it is the one being sung. */
export const activeScale = (isActive: boolean, wordProgress: number): number => {
  if (!isActive) return 1;
  return 1 + Math.sin(Math.min(1, Math.max(0, wordProgress)) * Math.PI) * 0.18;
};

/** Vertical offset of a letter in the ripple, by its position along the line. */
export const letterOffset = (x: number, timeMs: number, amplitude: number): number =>
  Math.sin(x / 70 + timeMs / 640) * amplitude;

/** Blend between the old word and the new one, 0..1. */
export const morphMix = (wordProgress: number): number =>
  Math.min(1, Math.max(0, wordProgress * 2.2));
