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
  exact: boolean;
}

export interface AudioView {
  /** False when no device is open or nothing is audibly playing. */
  active: boolean;
  level: number;
  bass: number;
  mid: number;
  high: number;
  beat: boolean;
  bpm: number;
  /** 16 log-spaced bands, 0..1. */
  bands: number[];
}

export interface Palette {
  accent: string;
  text: string;
  dim: string;
  background: string;
}

export interface StyleTrack {
  title: string;
  artist: string;
  app: string;
}

export interface StyleState {
  lines: LyricLine[];
  /** Index of the line being sung, -1 when between lines. */
  activeIndex: number;
  /** 0..1 through the active line. */
  lineProgress: number;
  /** Index of the active word inside the active line, -1 when none. */
  wordIndex: number;
  /** 0..1 through the active word. */
  wordProgress: number;
  /** Nudged playback position. */
  positionMs: number;
  playing: boolean;
  track: StyleTrack;
  palette: Palette;
  /** Milliseconds since the stage started, for ambient motion. */
  time: number;
  width: number;
  height: number;
  /** Per-style options, e.g. how many lines Context Window shows. */
  styleOptions?: Record<string, string | number | boolean>;
  /** Live audio analysis, absent when nothing is playing. */
  audio?: AudioView;
  /** Static layout, crossfades only. */
  reduceMotion?: boolean;
  /** No flashing or hard tearing, whatever the style defaults to. */
  photosensitive?: boolean;
}

export type StyleGroup = 'kinetic' | 'scenes' | 'native' | 'lyrics';
export type StyleStatus = 'stable' | 'beta' | 'hidden';
export type ColorMode = 'theme' | 'fixed';
export type BackgroundMode = 'stage' | 'own';
export type StyleMood =
  | 'calm'
  | 'moody'
  | 'bright'
  | 'nostalgic'
  | 'romantic'
  | 'energetic'
  | 'experimental';
export type DeskTag = 'minimal' | 'cozy' | 'rgb' | 'cinematic' | 'productive';
export type MotionTag = 'type' | 'ambient' | 'kinetic' | 'scene' | 'ui';
export type ScreenFit = 'compact' | 'balanced' | 'immersive';

/**
 * Traits are optional for older styles, but a style without them still gets
 * sensible group-based defaults on the site. New styles should set them.
 */
export interface StyleTraits {
  energy: 1 | 2 | 3 | 4 | 5;
  motion: 1 | 2 | 3 | 4 | 5;
  density: 1 | 2 | 3 | 4 | 5;
  vividness: 1 | 2 | 3 | 4 | 5;
  moods: StyleMood[];
  desks: DeskTag[];
  motionTags: MotionTag[];
  screenFit: ScreenFit;
}

export interface LyricStyle {
  id: string;
  name: string;
  description: string;
  group: StyleGroup;
  palette: Palette;
  /** Gallery thumbnail gradient. */
  gradient: [string, string];
  usesIcons: boolean;
  render(ctx: CanvasRenderingContext2D, state: StyleState): void;
  /** Gallery eyebrow, e.g. "Kinetic type". */
  eyebrow?: string;
  /** Tile sample text. */
  sample?: string;
  /** Marks a style added in the latest release. */
  isNew?: boolean;
  /** Effect ids this style supports behind the shared effects layer. */
  effects?: string[];
  /** Effects on by default for this style, unless the user turns them off. */
  defaultEffects?: string[];
  /** New styles can be hidden while they are being built. */
  status?: StyleStatus;
  introducedIn?: string;
  traits?: StyleTraits;
  colorMode?: ColorMode;
  background?: BackgroundMode;
  /** Optional hover/focus loop; the live canvas is the fallback. */
  media?: {
    poster: string;
    webm?: string;
    mp4?: string;
    alt: string;
  };
}

export interface FlatWord {
  text: string;
  startMs: number;
  endMs: number;
  lineIndex: number;
  wordIndex: number;
}

export function flattenWords(lines: LyricLine[]): FlatWord[] {
  const out: FlatWord[] = [];
  lines.forEach((line, lineIndex) => {
    line.words.forEach((word, wordIndex) => {
      out.push({
        text: word.text,
        startMs: word.startMs,
        endMs: word.endMs,
        lineIndex,
        wordIndex,
      });
    });
  });
  return out;
}

const UNSPACED_RANGES: [number, number][] = [
  [0x0e00, 0x0e7f], // Thai
  [0x0e80, 0x0eff], // Lao
  [0x1000, 0x109f], // Myanmar
  [0x1780, 0x17ff], // Khmer
  [0x3040, 0x30ff], // Hiragana and Katakana
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0x20000, 0x2fa1f],
];

/** True for scripts that are written without spaces between words. */
const isUnspacedScript = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  return UNSPACED_RANGES.some(([low, high]) => code >= low && code <= high);
};

/**
 * Gap between two neighbouring word tokens. Words inside an unspaced-script
 * run are single characters and must not be spread apart.
 */
export const wordGap = (previous: string, next: string, fallback: number): number =>
  isUnspacedScript(previous.slice(-1)) && isUnspacedScript(next.slice(0, 1)) ? 0 : fallback;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
