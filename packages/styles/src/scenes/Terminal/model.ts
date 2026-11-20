const LOGS = [
  'resolving media session …',
  'cache hit: lyrics/word-sync',
  'offset applied',
  'timing: exact',
  'palette: from artwork',
  'playing',
];

/** Harmless fake log lines, deterministic per line index. */
export function logsFor(lineIndex: number, count = 4): string[] {
  return Array.from({ length: count }, (_, index) => LOGS[(lineIndex + index * 3) % LOGS.length]);
}

/** Characters visible in the typed command at this progress. */
export const commandTyped = (text: string, progress: number): string =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.round(progress * text.length))));

/** Prompt blink: on for 500 ms of every 1000, never faster than 3 Hz. */
export const blinkOn = (timeMs: number): boolean => Math.floor(timeMs / 500) % 2 === 0;
