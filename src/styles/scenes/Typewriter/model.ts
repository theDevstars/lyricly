/** How many characters are typed for a line at this progress. */
export const typed = (text: string, progress: number): number =>
  Math.min(text.length, Math.floor(Math.min(1, Math.max(0, progress * 1.15)) * text.length));

/** Key-strike jitter for a character, deterministic. */
export const strikeJitter = (index: number): number => Math.sin(index * 12.9898) * 1.4;

/** The paper eases left as if the carriage returned. */
export const carriageOffset = (progress: number, width: number): number =>
  Math.min(width * 0.03, Math.max(0, progress - 0.92) * width * 0.3);
