import type { LyricLine, Snapshot } from '../types';

const HOLD_MS = 1600;

/** Interpolates the playback position between media-session samples. */
export function playbackPosition(snapshot: Snapshot, now = Date.now()): number {
  const { playback, settings } = snapshot;
  let position = playback.positionMs;
  if (playback.status === 'playing') {
    position += Math.max(0, now - playback.sampledAtMs);
  }
  if (playback.durationMs > 0) {
    position = Math.min(position, playback.durationMs);
  }
  return Math.max(0, position + settings.nudgeMs);
}

/** Index of the line being sung, or -1. Keeps the last line for a moment. */
export function activeLineIndex(lines: LyricLine[], position: number): number {
  if (lines.length === 0) return -1;
  if (position < lines[0].startMs - 400) return -1;

  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].startMs <= position) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (found === -1) return -1;
  if (position > lines[found].endMs + HOLD_MS) return -1;
  return found;
}

export function wordAt(
  line: LyricLine | null,
  position: number,
): { wordIndex: number; wordProgress: number; lineProgress: number } {
  if (!line) return { wordIndex: -1, wordProgress: 0, lineProgress: 0 };

  const span = Math.max(1, line.endMs - line.startMs);
  const lineProgress = Math.min(1, Math.max(0, (position - line.startMs) / span));

  let wordIndex = -1;
  for (let index = 0; index < line.words.length; index += 1) {
    const word = line.words[index];
    if (position >= word.startMs) {
      wordIndex = index;
      if (position < word.endMs) {
        const wordSpan = Math.max(1, word.endMs - word.startMs);
        const wordProgress = Math.min(1, Math.max(0, (position - word.startMs) / wordSpan));
        return { wordIndex, wordProgress, lineProgress };
      }
    } else {
      break;
    }
  }

  return { wordIndex, wordProgress: wordIndex >= 0 ? 1 : 0, lineProgress };
}
