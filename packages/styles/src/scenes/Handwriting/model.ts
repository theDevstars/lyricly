import { penEase } from '../../lib/strokePath';

/** Reveal fraction of the line, eased like a hand speeding up and slowing down. */
export const reveal = (lineProgress: number): number =>
  Math.min(1, Math.max(0, penEase(Math.min(1, lineProgress * 1.25))));

/** True while the pen is still writing this line. */
export const writing = (lineProgress: number): boolean => lineProgress < 0.8;

/** Ink bleed: a slightly offset second pass under the main stroke. */
export const inkBleed = (size: number): number => Math.max(0.4, size * 0.012);
