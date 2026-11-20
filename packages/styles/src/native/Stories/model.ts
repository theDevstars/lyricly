/** Vertical offset of the incoming card, as the line swipes up. */
export const swipe = (lineProgress: number, height: number): number => {
  const start = Math.min(1, lineProgress * 6);
  return (1 - start) * height * 0.28;
};

/** Card progress bar fill, 0..1 across the whole song. */
export const progressBar = (lineIndex: number, total: number, lineProgress: number): number => {
  const base = Math.max(0, lineIndex) / Math.max(1, total);
  const step = 1 / Math.max(1, total);
  return Math.min(1, base + step * Math.min(1, Math.max(0, lineProgress)));
};

/** Sticker tilt, alternating but deterministic. */
export const tilt = (lineIndex: number): number => ((lineIndex % 2 === 0 ? 1 : -1) * Math.PI) / 48;
