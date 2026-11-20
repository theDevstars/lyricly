import type { LyricLine } from '../types';

/**
 * The built-in preview lyric. Invented for Lyrica, so no real song, writer or
 * cover appears in the repository — and it carries real per-word timings, which
 * is what every style is judged against.
 */
interface ScriptLine {
  gapBefore?: number;
  words: string[];
}

const SCRIPT: ScriptLine[] = [
  { words: ['neon', 'on', 'the', 'overpass'] },
  { words: ['we', 'count', 'the', 'sleeping', 'cars'] },
  { words: ['every', 'window', 'holds', 'a', 'little', 'sun'] },
  { gapBefore: 900, words: ['hold', 'the', 'quiet', 'like', 'a', 'coin'] },
  { words: ['till', 'the', 'morning', 'spends', 'it'] },
  { words: ['paper', 'lanterns', 'in', 'the', 'rain'] },
  { words: ['swim', 'the', 'long', 'way', 'home'] },
  { gapBefore: 800, words: ['and', 'the', 'city', 'hums', 'along'] },
];

const WORD_MS = 340;
const LEAD_MS = 700;
const TAIL_MS = 900;

function build(): LyricLine[] {
  const lines: LyricLine[] = [];
  let cursor = LEAD_MS;

  for (const script of SCRIPT) {
    cursor += script.gapBefore ?? 260;
    const start = cursor;
    const words = script.words.map((text, index) => {
      const wordStart = start + index * WORD_MS;
      return { text, startMs: wordStart, endMs: wordStart + WORD_MS };
    });

    const end = start + script.words.length * WORD_MS + 220;
    lines.push({
      startMs: start,
      endMs: end,
      text: script.words.join(' '),
      words,
      exact: true,
    });
    cursor = end;
  }

  return lines;
}

export const DEMO_LINES: LyricLine[] = build();

export const DEMO_DURATION_MS =
  (DEMO_LINES[DEMO_LINES.length - 1]?.endMs ?? 20_000) + TAIL_MS;

export const DEMO_TITLE = 'Paper Lanterns';
export const DEMO_ARTIST = 'The Invented';
export const DEMO_ALBUM = 'Made for the preview';
