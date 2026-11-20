import { useEffect, useState } from "react";
import { allStyles } from "../../data/styles";
import { DEMO_DURATION_MS, DEMO_LINES } from "../../lib/demo";
import StyleCanvas from "./StyleCanvas";
import "../../styles/playground.css";

const dayNumber = () => Math.floor(Date.now() / 86_400_000);

export default function StyleOfDay() {
  const [offset, setOffset] = useState(0);
  const [today, setToday] = useState(0);

  useEffect(() => setToday(dayNumber()), []);

  const index = ((today + offset) % allStyles.length + allStyles.length) % allStyles.length;
  const style = allStyles[index];

  return (
    <section className="border-y border-line bg-surface/50" aria-labelledby="style-day-title">
      <div className="wrap py-8 sm:py-10">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">Style of the day</p>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="style-day-title" className="text-[clamp(1.7rem,3.4vw,2.4rem)] tracking-[-0.04em]">
                  {style.name}
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{style.description}</p>
              </div>
              <span className="badge badge-neutral shrink-0">{String(index + 1).padStart(2, "0")}/{allStyles.length}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost h-9 px-3.5 text-sm" onClick={() => setOffset((value) => value - 1)} aria-label="Previous style of the day">
                ← Previous
              </button>
              <button type="button" className="btn btn-ghost h-9 px-3.5 text-sm" onClick={() => setOffset((value) => value + 1)} aria-label="Next style of the day">
                Next →
              </button>
              <a href={`/playground?style=${style.slug}`} className="text-xs text-muted underline decoration-white/25 underline-offset-2 hover:text-white">
                Open in playground
              </a>
              <a href="/#styles" className="text-xs text-muted underline decoration-white/25 underline-offset-2 hover:text-white">
                See all styles
              </a>
            </div>
          </div>

          <div className="hero-day-stage">
            <StyleCanvas
              key={style.slug}
              style={style.renderer}
              lines={DEMO_LINES}
              palette={style.renderer.palette}
              playing
              loop
              startAt={1750}
              durationMs={DEMO_DURATION_MS}
              className="h-full w-full"
              label={`${style.name}, today's invented-lyric style preview`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
