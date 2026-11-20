/** Angle of a word on the ring, with the active word pulled to the front. */
export function ringAngle(index: number, activeIndex: number, count: number, spin: number): number {
  const step = (Math.PI * 2) / Math.max(1, count);
  const relative = index - Math.max(0, activeIndex);
  return relative * step - Math.PI / 2 + spin;
}

/** Words at the front are bigger and brighter. */
export function depthScale(angle: number): number {
  return 0.72 + (Math.sin(angle) + 1) * 0.14;
}

/** 0..1 brightness for a word at this angle. */
export const depthAlpha = (angle: number): number => 0.3 + ((Math.sin(angle) + 1) / 2) * 0.7;

/** Ring radius that keeps every word inside the stage. */
export const ringRadius = (width: number, height: number): number =>
  Math.min(width, height) * 0.31;
