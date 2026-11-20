import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { activeLineIndex, wordAt } from "../../../../src/lib/timing";
import { setStyleTextOptions } from "@lyrica/styles";
import type { LyricLine, LyricStyle, Palette } from "@lyrica/styles";

type Props = {
  style: LyricStyle;
  lines: LyricLine[];
  palette: Palette;
  className?: string;
  playing?: boolean;
  loop?: boolean;
  startAt?: number;
  seekTo?: number;
  durationMs: number;
  fontFamily?: string;
  fontScale?: number;
  tracks?: { title: string; artist: string; app: string };
  label: string;
  onPosition?: (positionMs: number) => void;
};

export default function StyleCanvas({
  style,
  lines,
  palette,
  className,
  playing = false,
  loop = true,
  startAt = 0,
  seekTo,
  durationMs,
  fontFamily = '"Inter Tight", Inter, sans-serif',
  fontScale = 1,
  tracks = { title: "Paper Lanterns", artist: "The Invented", app: "Lyrica preview" },
  label,
  onPosition,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionRef = useRef(startAt);
  const styleRef = useRef(style);
  const paletteRef = useRef(palette);
  const linesRef = useRef(lines);
  const systemReduced = useReducedMotion() ?? false;
  const [manualReduced, setManualReduced] = useState(false);
  const reduceMotion = systemReduced || manualReduced;
  const playingRef = useRef(playing);
  const optionsRef = useRef({ fontFamily, fontScale });
  const tracksRef = useRef(tracks);
  const lastPositionReport = useRef(0);

  styleRef.current = style;
  paletteRef.current = palette;
  linesRef.current = lines;
  playingRef.current = playing;
  optionsRef.current = { fontFamily, fontScale };
  tracksRef.current = tracks;

  useEffect(() => {
    if (typeof seekTo === "number") positionRef.current = seekTo;
  }, [seekTo]);

  useEffect(() => {
    const read = () => setManualReduced(document.documentElement.dataset.motion === "reduced");
    read();
    window.addEventListener("lyrica:motion", read);
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      window.removeEventListener("lyrica:motion", read);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let last = performance.now();
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      if (width < 2 || height < 2) return;
      const position = positionRef.current;
      const currentLines = linesRef.current;
      const currentStyle = styleRef.current;
      const options = optionsRef.current;
      setStyleTextOptions({ family: options.fontFamily, scale: options.fontScale });

      const index = activeLineIndex(currentLines, position);
      const line = index >= 0 ? currentLines[index] : null;
      const words = wordAt(line, position);

      context.save();
      context.setTransform(
        (canvas.width / width) || 1,
        0,
        0,
        (canvas.height / height) || 1,
        0,
        0,
      );
      currentStyle.render(context, {
        lines: currentLines,
        activeIndex: index,
        lineProgress: words.lineProgress,
        wordIndex: words.wordIndex,
        wordProgress: words.wordProgress,
        positionMs: position,
        playing: playingRef.current,
        track: { ...tracksRef.current },
        palette: paletteRef.current,
        time: reduceMotion ? 0 : position,
        width,
        height,
        reduceMotion,
        photosensitive: reduceMotion,
      });
      context.restore();
    };

    const tick = (now: number) => {
      const delta = Math.min(48, Math.max(0, now - last));
      last = now;
      if (playingRef.current && !reduceMotion) {
        positionRef.current += delta;
        if (positionRef.current > durationMs) {
          positionRef.current = loop ? 0 : durationMs;
        }
      }
      draw();
      if (onPosition && now - lastPositionReport.current > 120) {
        lastPositionReport.current = now;
        onPosition(positionRef.current);
      }
      frame = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (reduceMotion || !playing) {
      draw();
    }
    if (!reduceMotion) frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      setStyleTextOptions({ family: null, scale: 1 });
    };
  }, [durationMs, loop, onPosition, reduceMotion, playing, seekTo]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={label}
    />
  );
}
