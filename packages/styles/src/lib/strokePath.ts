/**
 * Helpers for the Handwriting style. Real glyph strokes would need a font
 * outline parser; instead the pen traces the line's measured width and the text
 * is revealed behind it with a soft mask, which reads as writing without
 * shipping a font or a parser.
 */

export interface PenPoint {
  x: number;
  y: number;
  /** 0..1 how far along the line the pen is. */
  progress: number;
}

/** Horizontal position of the pen at `progress`, with a gentle hand tremor. */
export function penAt(progress: number, lineWidth: number, seed: number): PenPoint {
  const clamped = Math.min(1, Math.max(0, progress));
  const wobble = Math.sin(clamped * 40 + seed) * Math.min(3, lineWidth * 0.006);
  return {
    x: clamped * lineWidth,
    y: wobble + Math.sin(clamped * 9 + seed * 0.7) * Math.min(5, lineWidth * 0.01),
    progress: clamped,
  };
}

/** Per-letter reveal: a letter is written once the pen has passed its centre. */
export function revealed(letterCentre: number, penProgress: number, lineWidth: number): boolean {
  if (lineWidth <= 0) return false;
  return letterCentre <= penProgress * lineWidth;
}

/** Speed ramp so the pen eases in and out instead of moving linearly. */
export const penEase = (t: number): number => {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - (-2 * clamped + 2) ** 2 / 2;
};
