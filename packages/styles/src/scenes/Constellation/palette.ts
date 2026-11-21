import type { Palette } from '../../types';

/**
 * Constellation's colours. Warm cream is the default; the cool silver-lavender
 * variant is the old look. Everything is derived from the resolved palette, so
 * the manual colour wells and an album-art Auto Sync palette both land here.
 */

export type ConstellationVariant = 'warm' | 'cool';

export interface ConstellationColors {
  background: string;
  /** Settled labels and the idle line. */
  text: string;
  /** The active word. */
  bright: string;
  /** 11-13px labels under their star. */
  label: string;
  line: string;
  halo: string;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

export function parseHex(value: string): Rgb | null {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((digit) => digit + digit)
      .join('');
  }
  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgba(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},${clamped})`;
}

function channelLuminance(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast against pure black, which is what the stage is. */
export function contrastOnBlack(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 0;
  return (luminance(rgb) + 0.05) / 0.05;
}

export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Lightens towards white until the colour is AA against the black stage. */
export function ensureContrast(color: string, minimum = 4.5): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  let current = rgb;
  for (let step = 0; step < 24 && contrastOnBlack(toHex(current)) < minimum; step += 1) {
    current = mix(current, WHITE, 0.12);
  }
  return toHex(current);
}

/**
 * Warm cream tinted towards an album-art colour. The artwork only nudges the
 * hue; the result is lightened until it reads AA on black.
 */
export function creamFromArt(art: string): string {
  const rgb = parseHex(art);
  if (!rgb) return '#F3E7C4';
  const tinted = mix({ r: 243, g: 231, b: 196 }, rgb, 0.18);
  return ensureContrast(toHex(tinted), 4.5);
}

const COOL = {
  background: '#04060f',
  text: '#c9ccff',
  bright: '#ffffff',
  line: 'rgba(200,205,255,0.42)',
  halo: 'rgba(170,180,255,0.18)',
} as const;

/**
 * @param base  The palette after manual wells, Auto Sync and theme resolution.
 * @param art   Dominant album-art colour, when the player provides one.
 */
export function constellationColors(
  base: Palette,
  variant: ConstellationVariant = 'warm',
  art?: string | null,
): ConstellationColors {
  if (variant === 'cool') {
    return {
      background: COOL.background,
      text: COOL.text,
      bright: COOL.bright,
      label: rgba(COOL.text, 0.55),
      line: COOL.line,
      halo: COOL.halo,
    };
  }

  const text = art ? creamFromArt(art) : ensureContrast(base.text, 4.5);
  const gold = parseHex(base.accent) ? base.accent : '#E2B24A';
  const bright = ensureContrast(toHex(mix(parseHex(text) ?? WHITE, WHITE, 0.45)), 4.5);

  return {
    background: '#050403',
    text,
    bright,
    label: rgba(text, 0.55),
    line: rgba(text, 0.45),
    halo: rgba(gold, 0.18),
  };
}

