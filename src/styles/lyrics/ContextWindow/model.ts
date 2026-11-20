/** How visible a line is by its distance from the active one. */
export function focus(distance: number): { scale: number; alpha: number; blur: number } {
  const abs = Math.abs(distance);
  return {
    scale: Math.max(0.52, 1 - abs * 0.16),
    alpha: Math.max(0.18, 1 - abs * 0.24),
    blur: Math.min(6, abs * 1.6),
  };
}

/** Lines around the active one that fit in a window of `count`. */
export function windowLines(lineCount: number, activeIndex: number, count: number): number[] {
  const half = Math.floor(count / 2);
  const start = Math.max(0, Math.min(lineCount - count, Math.max(0, activeIndex) - half));
  return Array.from({ length: Math.max(0, Math.min(count, lineCount)) }, (_, index) => start + index);
}

/** Clamp the visible-line setting to the supported range. */
export const clampCount = (value: number): number => Math.min(7, Math.max(3, Math.round(value || 5)));
