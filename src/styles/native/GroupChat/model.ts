const NAMES = ['Nova', 'Kai', 'Jules', 'Mira', 'Theo', 'Ren', 'Ash', 'Luca'];
const COLORS = ['#ff8ab5', '#8ad4ff', '#c0a2ff', '#ffd48a', '#8affc1', '#ffb08a'];

/** A stable invented author for a line. */
export function authorOf(lineIndex: number): { name: string; color: string; initials: string } {
  const name = NAMES[Math.abs(lineIndex) % NAMES.length];
  return { name, color: COLORS[Math.abs(lineIndex) % COLORS.length], initials: name.slice(0, 1) };
}

/** Clock shown beside a message, derived from the line's start. */
export function stamp(startMs: number): string {
  const seconds = Math.max(0, Math.floor(startMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Reactions that pop on chorus lines. */
export const REACTIONS = ['🔥', '💜', '🎶', '✨'];

/** Which messages from the visible window belong on screen, newest last. */
export function windowOf(lines: number, activeIndex: number, size = 5): number[] {
  const end = Math.max(0, activeIndex);
  const start = Math.max(0, end - size + 1);
  return Array.from({ length: Math.min(lines, end + 1) }, (_, index) => start + index).filter(
    (index) => index >= 0 && index < lines && index >= start,
  );
}
