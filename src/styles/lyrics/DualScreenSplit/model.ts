export interface Panes {
  split: boolean;
  main: { x: number; y: number; width: number; height: number };
  wall: { x: number; y: number; width: number; height: number };
}

/**
 * Two panes on a wide stage, stacked on a tall one. The style is designed for a
 * second display running the wall while the main one runs the type, but it also
 * reads correctly on a single screen.
 */
export function panesFor(width: number, height: number): Panes {
  const split = width / height > 1.35;
  if (!split) {
    return {
      split,
      main: { x: 0, y: 0, width, height: height * 0.62 },
      wall: { x: 0, y: height * 0.62, width, height: height * 0.38 },
    };
  }
  return {
    split,
    main: { x: 0, y: 0, width: width * 0.58, height },
    wall: { x: width * 0.58, y: 0, width: width * 0.42, height },
  };
}

/** Rows of the wall that fit in a pane. */
export const wallRows = (paneHeight: number, rowHeight: number): number =>
  Math.max(1, Math.floor(paneHeight / rowHeight));
