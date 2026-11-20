import type { Body } from '../../lib/physics';
import { spawnBodies, stepBodies } from '../../lib/physics';

/** Floor for the pile, leaving room for a caption. */
export const floorAt = (height: number): number => height * 0.88;

/** Bodies for a line, seeded by the text so a replay looks identical. */
export function bodiesFor(
  texts: string[],
  widths: number[],
  width: number,
  height: number,
  seed: number,
): Body[] {
  return spawnBodies(texts, widths, height, width, seed);
}

/** Advances the simulation by a frame. */
export const advance = (bodies: Body[], dtMs: number, height: number, width: number): void =>
  stepBodies(bodies, dtMs, floorAt(height), width);

/** Tilt is applied as a small rotation so piled words look hand-tossed. */
export const tilts = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => Math.sin(index * 2.4) * 0.09);
