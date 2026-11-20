export interface Bar {
  wordIndex: number;
  x: number;
  width: number;
  y: number;
  height: number;
  active: boolean;
}

/** Bar geometry: x is the word's lane, height follows the falling note. */
export function barsFor(
  words: { startMs: number; endMs: number }[],
  positionMs: number,
  laneWidth: number,
  stageHeight: number,
  nowY: number,
  lookAheadMs = 2400,
): Bar[] {
  return words.map((word, wordIndex) => {
    const duration = Math.max(80, word.endMs - word.startMs);
    const height = Math.max(10, (duration / lookAheadMs) * stageHeight * 0.8);
    const startOffset = (word.startMs - positionMs) / lookAheadMs;
    const y = nowY - startOffset * stageHeight * 0.8 - height;
    return {
      wordIndex,
      x: wordIndex * laneWidth,
      width: Math.max(8, laneWidth * 0.68),
      y,
      height,
      active: positionMs >= word.startMs && positionMs < word.endMs,
    };
  });
}

/** How close a bar is to the now line, 0..1. */
export const proximity = (bar: Bar, nowY: number): number =>
  Math.max(0, 1 - Math.abs(bar.y + bar.height - nowY) / 200);
