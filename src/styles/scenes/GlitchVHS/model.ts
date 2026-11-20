/** Horizontal RGB split, in px. Capped low for photosensitivity. */
export function split(timeMs: number, photosensitive: boolean): number {
  if (photosensitive) return 1.2;
  return 2 + Math.abs(Math.sin(timeMs / 420)) * 5;
}

export interface Tear {
  y: number;
  height: number;
  offset: number;
}

/** Deterministic tear bands for a moment in time. */
export function tears(timeMs: number, height: number, photosensitive: boolean, seed: number): Tear[] {
  if (photosensitive) return [];
  const bands: Tear[] = [];
  const frame = Math.floor(timeMs / 90);
  for (let index = 0; index < 3; index += 1) {
    const hash = Math.sin(frame * 12.9898 + index * 78.233 + seed) * 43758.5453;
    const unit = hash - Math.floor(hash);
    bands.push({
      y: unit * height,
      height: 4 + unit * 22,
      offset: (unit - 0.5) * 34,
    });
  }
  return bands;
}

/** Tracking band that sweeps down the frame. */
export const trackingY = (timeMs: number, height: number): number =>
  ((timeMs / 9) % (height + 200)) - 100;
