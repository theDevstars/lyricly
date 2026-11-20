/** Font size that fits a block of rows into the stage. */
export function fitSize(
  rows: number,
  widestRatio: number,
  width: number,
  height: number,
): number {
  const byHeight = (height * 0.82) / Math.max(1, rows * 1.3);
  const byWidth = (width * 0.9) / Math.max(1, widestRatio);
  return Math.max(10, Math.min(byHeight, byWidth));
}

/** Words that are lit: everything up to the current position. */
export function litUpTo(words: { startMs: number }[], positionMs: number): number {
  let lit = -1;
  words.forEach((word, index) => {
    if (word.startMs <= positionMs) lit = index;
  });
  return lit;
}
