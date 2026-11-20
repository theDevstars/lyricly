/** Scale and opacity for a line `age` lines behind the active one. */
export function echo(age: number): { scale: number; alpha: number; lift: number } {
  return {
    scale: Math.max(0.3, 1 - age * 0.22),
    alpha: Math.max(0.08, 0.7 - age * 0.16),
    lift: age * 0.9,
  };
}

/** How many past lines are still visible. */
export const trailLength = (height: number): number => Math.max(3, Math.min(7, Math.round(height / 90)));
