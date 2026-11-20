import type { LyricLine } from "@lyrica/styles";

export {
  DEMO_ALBUM,
  DEMO_ARTIST,
  DEMO_DURATION_MS,
  DEMO_LINES,
  DEMO_TITLE,
} from "../../../src/demo/demoTrack";

export const DEMO_SONG = {
  title: "Paper Lanterns",
  artist: "The Invented",
  album: "Made for the preview",
};

/** Generated gradient covers. No real artwork or label marks. */
export const DEMO_COVERS = [
  { id: "lanterns", name: "Paper Lanterns", colors: ["#ff8a5c", "#7c3aed", "#160b1f"] },
  { id: "overpass", name: "Neon Overpass", colors: ["#35c6c0", "#0b4f6c", "#041014"] },
  { id: "quiet", name: "Quiet Coin", colors: ["#f5d67b", "#a34b2a", "#1d1008"] },
  { id: "rain", name: "Rain Ledger", colors: ["#8fb4ff", "#354a8f", "#070b18"] },
] as const;

/**
 * Turns up to 200 characters into invented, word-timed lines. Nothing is sent
 * anywhere; the text exists only in the current browser tab.
 */
export function linesFromText(text: string): LyricLine[] {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) return [];

  const words = clean.split(" ").filter(Boolean);
  const lines: LyricLine[] = [];
  const perLine = Math.max(3, Math.ceil(words.length / Math.max(1, Math.ceil(words.length / 6))));
  let cursor = 500;

  for (let start = 0; start < words.length; start += perLine) {
    const chunk = words.slice(start, start + perLine);
    const lineStart = cursor;
    const timed = chunk.map((word, index) => {
      const wordStart = lineStart + index * 360;
      return { text: word, startMs: wordStart, endMs: wordStart + 340 };
    });
    const end = lineStart + chunk.length * 360 + 180;
    lines.push({
      startMs: lineStart,
      endMs: end,
      text: chunk.join(" "),
      words: timed,
      exact: true,
    });
    cursor = end + 220;
  }

  return lines;
}

export const DURATION_FOR_LINES = (lines: LyricLine[]): number =>
  Math.max(6000, (lines[lines.length - 1]?.endMs ?? 6000) + 900);
