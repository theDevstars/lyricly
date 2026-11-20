/** Scroll offset that centres the active line in a wall of `rowHeight` rows. */
export const wallOffset = (activeIndex: number, rowHeight: number, height: number): number =>
  height / 2 - Math.max(0, activeIndex) * rowHeight - rowHeight / 2;

/** How far a row is from the centre, in rows. */
export const distanceRows = (index: number, activeIndex: number): number => index - activeIndex;

/** Dimming for a row by distance. */
export const rowAlpha = (distance: number): number => Math.max(0.12, 1 - Math.abs(distance) * 0.28);
