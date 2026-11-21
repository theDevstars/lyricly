import { withAlpha } from './colors';
import { rimIntensity, rimSides, type CutoutMask, type Point } from './rimGlow';

export interface RimDrawOptions {
  width: number;
  height: number;
  thickness: number;
  glow: number;
  animation: string;
  colorA: string;
  colorB: string;
  cutout: CutoutMask | null;
  beat: boolean;
  reduceMotion: boolean;
  timeMs: number;
}

function stroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  lineWidth: number,
  paint: string | CanvasGradient,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = paint;
  ctx.stroke();
}

/**
 * Paints one frame of the edge light in CSS pixels (the caller sets the DPR
 * transform). Kept out of the component so a harness can draw exactly the same
 * thing the ambient window draws.
 */
export function drawRim(ctx: CanvasRenderingContext2D, options: RimDrawOptions): void {
  const { width, height } = options;
  if (width < 2 || height < 2) return;

  const intensity = rimIntensity(options.timeMs, {
    beat: options.beat,
    glow: options.glow,
    animation: options.animation,
    reduceMotion: options.reduceMotion,
  });

  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sides = rimSides({
    width,
    height,
    inset: Math.max(2.5, options.thickness / 2),
    cutout: options.cutout,
  });

  // Brightest at the top and bottom: the horizontal gradient runs A-B-A, and the
  // side gradient fades through the middle so the columns read thinner.
  const across = ctx.createLinearGradient(0, 0, width, 0);
  across.addColorStop(0, withAlpha(options.colorA, 1));
  across.addColorStop(0.5, withAlpha(options.colorB, 1));
  across.addColorStop(1, withAlpha(options.colorA, 1));

  const down = ctx.createLinearGradient(0, 0, 0, height);
  down.addColorStop(0, withAlpha(options.colorA, 1));
  down.addColorStop(0.5, withAlpha(options.colorB, 0.35));
  down.addColorStop(1, withAlpha(options.colorA, 1));

  const bloom = Math.max(8, options.thickness * 2.2);
  const glow = Math.min(1, Math.max(0, options.glow));

  ctx.shadowColor = withAlpha(options.colorA, 0.5 * intensity);
  ctx.shadowBlur = bloom * 1.3;
  ctx.globalAlpha = 0.1 * glow * intensity;
  stroke(ctx, sides.top, bloom * 1.9, across);
  stroke(ctx, sides.bottom, bloom * 1.9, across);
  stroke(ctx, sides.left, bloom * 1.1, down);
  stroke(ctx, sides.right, bloom * 1.1, down);

  ctx.shadowBlur = bloom * 0.6;
  ctx.globalAlpha = 0.2 * glow * intensity;
  stroke(ctx, sides.top, bloom, across);
  stroke(ctx, sides.bottom, bloom, across);
  stroke(ctx, sides.left, bloom * 0.6, down);
  stroke(ctx, sides.right, bloom * 0.6, down);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.85 * intensity;
  stroke(ctx, sides.top, 3, across);
  stroke(ctx, sides.bottom, 3, across);
  stroke(ctx, sides.left, 2, down);
  stroke(ctx, sides.right, 2, down);

  // Crisp 2px core, cream rather than gold, right on the border.
  ctx.globalAlpha = Math.min(1, intensity);
  stroke(ctx, sides.top, 2, withAlpha(options.colorB, 1));
  stroke(ctx, sides.bottom, 2, withAlpha(options.colorB, 1));

  ctx.globalAlpha = 1;
}
