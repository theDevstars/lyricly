/**
 * Rim Light geometry: the glow follows the screen edge, and dips around a
 * camera cutout with rounded inner corners. Pure so the shape can be tested
 * without a canvas, and so a window on any monitor can build its own.
 */

export interface Point {
  x: number;
  y: number;
}

export interface CutoutMask {
  width: number;
  height: number;
  /** Inner corner radius where the edge turns into the notch. */
  radius?: number;
}

export interface RimGeometry {
  width: number;
  height: number;
  /** Distance of the light's centre line from the screen edge. */
  inset: number;
  cutout?: CutoutMask | null;
}

export interface RimSides {
  top: Point[];
  right: Point[];
  bottom: Point[];
  left: Point[];
}

const STEPS = 4;

/** Samples a quarter circle, walking from `from` degrees to `to` degrees. */
function arc(
  center: Point,
  radius: number,
  from: number,
  to: number,
): Point[] {
  const points: Point[] = [];
  for (let step = 1; step <= STEPS; step += 1) {
    const angle = from + ((to - from) * step) / STEPS;
    const radians = (angle * Math.PI) / 180;
    points.push({
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    });
  }
  return points;
}

/**
 * The four sides of the light, top first. The top side carries the notch: down
 * into the cutout, across it, and back up, each turn rounded.
 */
export function rimSides(geometry: RimGeometry): RimSides {
  const inset = Math.max(1, geometry.inset);
  const left = inset;
  const right = Math.max(inset + 1, geometry.width - inset);
  const top = inset;
  const bottom = Math.max(inset + 1, geometry.height - inset);

  const cutout = geometry.cutout;
  const usable = cutout && cutout.width > 0 && cutout.height > 0;

  if (!usable || !cutout) {
    return {
      top: [
        { x: left, y: top },
        { x: right, y: top },
      ],
      right: [
        { x: right, y: top },
        { x: right, y: bottom },
      ],
      bottom: [
        { x: right, y: bottom },
        { x: left, y: bottom },
      ],
      left: [
        { x: left, y: bottom },
        { x: left, y: top },
      ],
    };
  }

  const width = Math.min(cutout.width, Math.max(8, geometry.width - inset * 2 - 8));
  const height = Math.min(cutout.height, Math.max(4, geometry.height * 0.4));
  const radius = Math.min(cutout.radius ?? Math.min(12, height / 2), width / 2, height);
  const start = geometry.width / 2 - width / 2;
  const end = geometry.width / 2 + width / 2;

  const topPoints: Point[] = [
    { x: left, y: top },
    { x: start, y: top },
  ];

  // Down the left inner corner.
  topPoints.push(
    ...arc({ x: start + radius, y: top + radius }, radius, 270, 180),
    { x: start, y: top + height - radius },
    ...arc({ x: start + radius, y: top + height - radius }, radius, 180, 90),
    { x: end - radius, y: top + height },
    ...arc({ x: end - radius, y: top + height - radius }, radius, 90, 0),
    { x: end, y: top + radius },
    ...arc({ x: end - radius, y: top + radius }, radius, 0, -90),
    { x: right, y: top },
  );

  return {
    top: topPoints,
    right: [
      { x: right, y: top },
      { x: right, y: bottom },
    ],
    bottom: [
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
    left: [
      { x: left, y: bottom },
      { x: left, y: top },
    ],
  };
}

/**
 * Light level for a frame: a slow breath when idle, a short lift on a beat.
 * Nothing above 1, and nothing distracting under Reduce Motion.
 */
export function rimIntensity(
  timeMs: number,
  options: { beat: boolean; glow: number; animation: string; reduceMotion: boolean },
): number {
  const base = 0.55 + options.glow * 0.35;
  if (options.reduceMotion) return Math.min(1, base + 0.1);
  const breathe =
    options.animation === 'still'
      ? 0
      : options.animation === 'drift'
        ? Math.sin(timeMs * 0.0006) * 0.08
        : Math.sin(timeMs * 0.0009) * 0.12;
  const pulse = options.beat ? 0.22 : 0;
  return Math.min(1.15, Math.max(0.25, base + breathe + pulse));
}
