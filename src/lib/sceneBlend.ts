/**
 * How a lyric style should composite onto the desktop wallpaper scene.
 *
 * Every style paints a full-bleed stage. Dropped onto the scene as-is, that
 * stage hides the planet. Blending removes the stage while keeping the type:
 * a dark stage screens away (black is the identity), and a light paper stage
 * multiplies away (white is the identity), which leaves the ink readable.
 */
export type SceneBlend = 'screen' | 'normal';

export interface SceneLayer {
  blend: SceneBlend;
  /** Fraction of the window left as a frame, so a paper page floats. */
  inset: number;
}

/** Above this the style counts as a light "paper" stage. */
export const LIGHT_BACKGROUND = 0.5;

const parseHex = (value: string): [number, number, number] | null => {
  const clean = value.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const number = Number.parseInt(full, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

/** 0 (black) .. 1 (white), weighted for the eye. */
export function backgroundLuminance(value: string | undefined): number | null {
  if (!value) return null;
  const rgb = parseHex(value);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => channel / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Dark stages screen, so their black drops out and the planet shows through.
 * Light paper stages cannot be blended away (their ink is darker than the
 * planet, so multiply erases it); they float as an inset page instead.
 * Unknown or gradient backgrounds keep the dark-stage default.
 */
export function sceneBlendFor(background: string | undefined): SceneBlend {
  const luminance = backgroundLuminance(background);
  if (luminance === null) return 'screen';
  return luminance >= LIGHT_BACKGROUND ? 'normal' : 'screen';
}

export function sceneLayerFor(background: string | undefined): SceneLayer {
  return sceneBlendFor(background) === 'normal'
    ? { blend: 'normal', inset: 0.12 }
    : { blend: 'screen', inset: 0 };
}

/**
 * The page frame in pixels, measured from the short edge so a 2560x1440
 * monitor gets the same margin all round instead of a thin strip at the top
 * and bottom. Never smaller than 48px, so the planet always reads as a frame.
 */
export function pageInsetPx(width: number, height: number, ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.max(48, Math.round(Math.min(width, height) * ratio));
}
