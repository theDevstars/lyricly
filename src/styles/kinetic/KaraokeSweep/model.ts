export interface Fill {
  /** 0..1 of the word that is filled. */
  amount: number;
  past: boolean;
  current: boolean;
  upcoming: boolean;
}

/** Fill amount for one word at a moment in the song. */
export function fillAt(
  word: { startMs: number; endMs: number },
  positionMs: number,
  wordIndex: number,
  activeWordIndex: number,
): Fill {
  const span = Math.max(1, word.endMs - word.startMs);
  const raw = (positionMs - word.startMs) / span;
  const amount = Math.min(1, Math.max(0, raw));
  return {
    amount,
    past: raw >= 1,
    current: wordIndex === activeWordIndex && raw >= 0 && raw < 1,
    upcoming: raw <= 0,
  };
}

/** X offset of the fill edge inside a word box. */
export const fillEdge = (width: number, amount: number): number =>
  Math.max(0, Math.min(width, width * amount));

/** Cursor radius, in px, for a stage of this height. */
export const cursorRadius = (height: number): number => Math.max(2, Math.min(6, height * 0.006));
