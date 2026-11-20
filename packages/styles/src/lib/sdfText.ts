/**
 * Displacement maths for Liquid Type. The style draws each letter with a small
 * vertical offset and a wobble derived from here, which is a cheap stand-in for
 * a signed-distance-field shader and stays 60 fps on integrated graphics.
 */

/** A travelling wave; `phase` lets neighbouring letters lag so the line ripples. */
export function ripple(timeMs: number, x: number, amplitude: number, wavelength = 90): number {
  return Math.sin((x / wavelength) * Math.PI * 2 + timeMs / 620) * amplitude;
}

/** Vertical stretch of a letter while the line is being sung. */
export function swell(wordProgress: number): number {
  const bump = Math.sin(Math.min(1, Math.max(0, wordProgress)) * Math.PI);
  return 1 + bump * 0.22;
}

/** The drop that morphs from one word to the next: 0 at the old, 1 at the new. */
export function morph(wordIndex: number, wordProgress: number, previousIndex: number): number {
  if (wordIndex !== previousIndex) return 0;
  return Math.min(1, Math.max(0, wordProgress * 2));
}

/** Blur/echo strength at the tail of a word, so the swell settles. */
export const settle = (wordProgress: number): number =>
  Math.max(0, 1 - Math.min(1, Math.max(0, wordProgress))) ** 2;
