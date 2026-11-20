import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { allStyles } from "../../data/styles";
import { DEMO_DURATION_MS, DEMO_LINES } from "../../lib/demo";
import StyleCanvas from "./StyleCanvas";
import "../../styles/scroll.css";

const featured = ["tunnel", "neon-sign", "handwriting", "waveform-words", "poster-collage", "karaoke-sweep"]
  .map((id) => allStyles.find((style) => style.slug === id))
  .filter((style): style is (typeof allStyles)[number] => Boolean(style));

export default function ScrollStyleScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const style = featured[index % featured.length];

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "120px 0px",
      threshold: 0.02,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const total = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      setIndex(Math.min(featured.length - 1, Math.floor(progress * featured.length)));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  if (!style) return null;

  return (
    <section ref={ref} className="scroll-scene" aria-labelledby="scroll-scene-title">
      <div className="scroll-sticky">
        <div className="wrap">
          <div className="scroll-head">
            <p className="eyebrow">A style for the whole desk</p>
            <h2 id="scroll-scene-title" className="section-title mt-2">Keep scrolling. The room changes.</h2>
          </div>
          <div className="scroll-stage" style={{ boxShadow: `0 0 80px -18px ${style.renderer.gradient[0]}88` }}>
            <StyleCanvas
              key={style.slug}
              style={style.renderer}
              lines={DEMO_LINES}
              palette={style.renderer.palette}
              playing={visible && !reduceMotion}
              loop
              startAt={1750}
              durationMs={DEMO_DURATION_MS}
              className="h-full w-full"
              label={`${style.name} live preview`}
            />
            <div className="scroll-stage-meta">
              <span>{style.name}</span>
              <span>{style.group}</span>
              <a href={`/playground?style=${style.slug}`}>Open in playground →</a>
            </div>
          </div>
          <div className="scroll-dots" aria-hidden="true">
            {featured.map((entry, dot) => <span key={entry.slug} data-active={dot === index} />)}
          </div>
          <p className="scroll-caption">
            The panel is sticky; the style changes as you scroll. With reduced motion on, it stays
            on one static frame.
          </p>
        </div>
      </div>
    </section>
  );
}
