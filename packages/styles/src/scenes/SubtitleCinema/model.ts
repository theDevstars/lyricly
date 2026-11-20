/** Fade in at the start of a line and out at the very end. */
export function subtitleAlpha(lineProgress: number): number {
  if (lineProgress < 0.06) return lineProgress / 0.06;
  if (lineProgress > 0.94) return Math.max(0, (1 - lineProgress) / 0.06);
  return 1;
}

/** The key word to pick out: the longest word of the line. */
export function keyWordIndex(words: { text: string }[]): number {
  let best = -1;
  let length = 2;
  words.forEach((word, index) => {
    const clean = word.text.replace(/[^\p{L}\p{N}]/gu, '');
    if (clean.length > length) {
      length = clean.length;
      best = index;
    }
  });
  return best;
}

/** Letterbox height, in px, for a stage of this height. */
export const letterbox = (height: number): number => Math.max(20, height * 0.1);
