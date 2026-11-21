import { useEffect, useRef } from 'react';
import { drawRim } from '../lib/rimDraw';

export interface RimGlowProps {
  /** Ring thickness in CSS pixels, 2-24. */
  thickness: number;
  /** 0..1 bloom amount. */
  glow: number;
  /** "breathe" | "drift" | "still". */
  animation: string;
  colorA: string;
  colorB: string;
  cutout: boolean;
  cutoutWidth: number;
  cutoutHeight: number;
  /** Beat flag from the audio analyser. */
  beat: boolean;
  reduceMotion: boolean;
}

/**
 * The edge light, drawn per window so every monitor gets its own glow at its own
 * real edges. A crisp 2-3px core rides the screen border, a soft bloom spills
 * inward, the top and bottom edges run brighter than the sides, and the line
 * dips around a camera cutout when the mask is on.
 */
export function RimGlow(props: RimGlowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef(props);
  live.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (width < 2 || height < 2) return;
      const current = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRim(ctx, {
        width,
        height,
        thickness: current.thickness,
        glow: current.glow,
        animation: current.animation,
        colorA: current.colorA,
        colorB: current.colorB,
        cutout: current.cutout
          ? { width: current.cutoutWidth, height: current.cutoutHeight }
          : null,
        beat: current.beat,
        reduceMotion: current.reduceMotion,
        timeMs: performance.now(),
      });
    };

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="rim-glow" aria-hidden="true" />;
}
