import type { Palette } from '@lyrica/styles';
import type { ArtPalette, Settings } from '../types';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#?([\da-f]{3}|[\da-f]{6})$/i;

export function parseHex(value: string): Rgb | null {
  const match = HEX.exec(value.trim());
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
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function channelLuminance(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG 2.1 contrast ratio, 1:1 to 21:1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Adds alpha to a hex colour, for the dim slot the styles expect. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},${alpha})`;
}

/**
 * Palette from the current cover. The art colour is only a seed: text is
 * lightened until it is AA on a black stage, and the accent keeps 3:1 because
 * it is used for display type and glow.
 */
export function paletteFromArt(art: ArtPalette, base: Palette): Palette {
  const accent = parseHex(art.accent);
  const dominant = parseHex(art.dominant);
  // A half-parsed cover is worse than none: keep the style's own palette.
  if (!accent || !dominant) return base;

  const text = ensureContrast(mix(dominant, { r: 255, g: 255, b: 255 }, 0.35), 4.5);
  const highlight = ensureContrast(mix(accent, { r: 255, g: 255, b: 255 }, 0.18), 3);

  return {
    ...base,
    accent: highlight,
    text,
    dim: withAlpha(text, 0.55),
  };
}

function ensureContrast(rgb: Rgb, minimum: number): string {
  let current = rgb;
  for (let step = 0; step < 24 && contrastRatio(current, { r: 0, g: 0, b: 0 }) < minimum; step += 1) {
    current = mix(current, { r: 255, g: 255, b: 255 }, 0.12);
  }
  return toHex(current);
}

/**
 * Colours actually drawn: with Auto Sync on, the cover's palette (when the
 * player supplied one); otherwise the style's own palette. Manual wells always
 * win when Auto Sync is off.
 */
export function resolvePalette(
  base: Palette,
  settings: Settings,
  art?: ArtPalette | null,
): Palette {
  if (settings.colorAutoSync) return art ? paletteFromArt(art, base) : base;
  return {
    ...base,
    accent: settings.colorHighlight || base.accent,
    text: settings.colorText || base.text,
    dim: settings.colorSecondary || base.dim,
  };
}

export interface ContrastWarning {
  label: string;
  ratio: number;
}

/** AA is 4.5:1 for body text; 3:1 is allowed for large display type. */
export function contrastWarnings(
  palette: Palette,
  background = '#050607',
): ContrastWarning[] {
  const backdrop = parseHex(background);
  if (!backdrop) return [];

  const checks: { label: string; color: string }[] = [
    { label: 'Lyric text', color: palette.text },
    { label: 'Highlight', color: palette.accent },
    { label: 'Secondary text', color: palette.dim },
  ];

  return checks
    .map(({ label, color }) => {
      const rgb = parseHex(color);
      return rgb ? { label, ratio: contrastRatio(rgb, backdrop) } : null;
    })
    .filter((entry): entry is ContrastWarning => entry !== null && entry.ratio < 4.5);
}
