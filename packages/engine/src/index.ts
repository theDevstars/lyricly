export type PlayState = 'playing' | 'paused' | 'stopped';
export type TimingType = 'WordSynced' | 'LineSynced' | 'Estimated' | 'Unsynced';
export type WordVisualState = 'hidden' | 'ghost' | 'active' | 'settled';

export interface LyricWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface LyricLine {
  startMs: number;
  endMs: number;
  text: string;
  words: LyricWord[];
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

export interface LyricState {
  track: TrackInfo;
  playState: PlayState;
  positionMs: number;
  lines: LyricLine[];
  activeLineIndex: number;
  activeWordIndex: number;
  wordProgress: number;
  timingType: TimingType;
  source: string;
  offsetMs: number;
  updatedAt: number;
}

export interface StyleMeta {
  id: string;
  name: string;
  group: string;
  description: string;
  gradient: [string, string];
  supports: { colors: boolean; fonts: boolean; effects: string[] };
}

export interface LyricStyle {
  meta: StyleMeta;
  mount(container: HTMLElement, context: StyleContext): void;
  update(state: LyricState): void;
  resize(): void;
  dispose(): void;
}

export interface StyleContext {
  reducedMotion: boolean;
  scale: number;
}

export function wordState(
  playheadMs: number,
  word: LyricWord,
  previousWord?: LyricWord,
): WordVisualState {
  const ghostLead = previousWord
    ? Math.min(150, Math.max(0, (previousWord.endMs - previousWord.startMs) / 2))
    : 120;
  if (playheadMs < word.startMs - ghostLead) return 'hidden';
  if (playheadMs < word.startMs) return 'ghost';
  if (playheadMs <= word.endMs || playheadMs < word.startMs + 180) return 'active';
  return 'settled';
}

export function createLyricState(
  track: TrackInfo,
  lines: LyricLine[],
  positionMs: number,
  playState: PlayState = 'playing',
  offsetMs = 0,
): LyricState {
  const position = Math.max(0, positionMs + offsetMs);
  const activeLineIndex = lines.findIndex(
    (line) => position >= line.startMs && position <= line.endMs,
  );
  const line = activeLineIndex >= 0 ? lines[activeLineIndex] : undefined;
  const activeWordIndex = line
    ? line.words.findIndex(
        (word) => position >= word.startMs - 120 && position <= word.endMs,
      )
    : -1;
  const word = line && activeWordIndex >= 0 ? line.words[activeWordIndex] : undefined;
  const wordProgress = word
    ? Math.max(0, Math.min(1, (position - word.startMs) / Math.max(1, word.endMs - word.startMs)))
    : 0;
  return {
    track,
    playState,
    positionMs: position,
    lines,
    activeLineIndex,
    activeWordIndex,
    wordProgress,
    timingType: 'WordSynced',
    source: 'DemoPlayer',
    offsetMs,
    updatedAt: Date.now(),
  };
}

/** Parse standard LRC timestamps, repeated timestamps, offsets, BOM and CRLF. */
export function parseLrc(input: string): LyricLine[] {
  let offsetMs = 0;
  const rows: Array<{ time: number; text: string }> = [];
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (const rawLine of normalized.split('\n')) {
    const offset = rawLine.match(/^\[offset:([+-]?\d+)\]$/i);
    if (offset) {
      offsetMs = Number(offset[1]);
      continue;
    }
    const times = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})\.(\d{2,3})\]/g)];
    if (!times.length) continue;
    const text = rawLine.replace(/\[\d{1,3}:\d{2}\.\d{2,3}\]/g, '').trim();
    for (const time of times) {
      const fraction = time[3].length === 2 ? Number(time[3]) * 10 : Number(time[3]);
      rows.push({ time: Math.max(0, Number(time[1]) * 60_000 + Number(time[2]) * 1_000 + fraction + offsetMs), text });
    }
  }
  rows.sort((a, b) => a.time - b.time);
  return rows.map((row, index) => {
    const next = rows[index + 1];
    const startMs = row.time;
    const endMs = Math.max(startMs + 1, next?.time ?? startMs + 4_000);
    const tokens = row.text.match(/\S+/gu) ?? [];
    const totalWeight = tokens.reduce((sum, token) => sum + Math.max(1, token.replace(/[^\p{L}\p{N}]/gu, '').length), 0);
    let cursor = startMs;
    const words = tokens.map((text, wordIndex) => {
      const weight = Math.max(1, text.replace(/[^\p{L}\p{N}]/gu, '').length);
      const wordStart = cursor;
      cursor = wordIndex === tokens.length - 1
        ? endMs
        : wordStart + (endMs - startMs) * weight / totalWeight;
      return { text, startMs: wordStart, endMs: Math.max(wordStart + 1, cursor) };
    });
    return { startMs, endMs, text: row.text, words };
  });
}

export const DEMO_TRACK: TrackInfo = {
  title: 'Paper Lanterns',
  artist: 'The Invented',
  album: 'Little Lights',
  durationMs: 24_000,
};

const demoLines = [
  ['The evening folds the gold into the blue', 0],
  ['A paper lantern learns to float', 4_000],
  ['We leave a little light for every road', 8_000],
  ['And let the quiet carry us back home', 12_000],
  ['The city hums a soft familiar tune', 16_000],
  ['One small spark can make the whole night glow', 20_000],
] as const;

export const DEMO_LYRICS: LyricLine[] = demoLines.map(([text, startMs]) => {
  const endMs = startMs + 4_000;
  const tokens = text.split(' ');
  const beat = (endMs - startMs) / tokens.length;
  return {
    text,
    startMs,
    endMs,
    words: tokens.map((word, index) => ({
      text: word,
      startMs: startMs + index * beat,
      endMs: startMs + (index + 1) * beat,
    })),
  };
});

export function getDemoState(positionMs: number, playState: PlayState = 'playing'): LyricState {
  return createLyricState(DEMO_TRACK, DEMO_LYRICS, positionMs, playState);
}

export function splitPhrases(text: string, maxChars = 38, maxWords = 6): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    const candidate = [...current, word];
    if (current.length && (candidate.join(' ').length > maxChars || candidate.length > maxWords)) {
      result.push(current.join(' '));
      current = [word];
    } else {
      current = candidate;
    }
  }
  if (current.length) {
    if (current.length === 1 && result.length && result.at(-1)!.split(/\s+/).length < maxWords) {
      result[result.length - 1] += ` ${current[0]}`;
    } else result.push(current.join(' '));
  }
  return result;
}
