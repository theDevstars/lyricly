import { useMemo, useState } from "react";
import { allStyles } from "../../data/styles";
import { DURATION_FOR_LINES, linesFromText } from "../../lib/demo";
import StyleCanvas from "./StyleCanvas";
import "../../styles/playground.css";

const SAMPLE = "neon on the overpass, we count the sleeping cars";
const PREVIEW_IDS = [
  "ship",
  "gravity-drop",
  "karaoke-sweep",
  "codestyle",
  "handwriting",
  "neon-sign",
  "messages",
  "waveform-words",
];

export default function TryYourText() {
  const [text, setText] = useState(SAMPLE);
  const [playing, setPlaying] = useState(false);

  const lines = useMemo(() => linesFromText(text || SAMPLE), [text]);
  const duration = useMemo(() => DURATION_FOR_LINES(lines), [lines]);
  const previews = useMemo(
    () =>
      PREVIEW_IDS.map((id) => allStyles.find((style) => style.slug === id))
        .filter(Boolean)
        .slice(0, 8) as typeof allStyles,
    [],
  );

  return (
    <section className="section border-t border-line" aria-labelledby="own-text-title">
      <div className="wrap">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div data-reveal>
            <p className="eyebrow">Try it on your own text</p>
            <h2 id="own-text-title" className="section-title mt-3.5">Your words, eight ways.</h2>
            <p className="lead mt-4">
              Type up to 200 characters. Lyrica times it word by word in the browser, so you can
              judge the type without installing anything.
            </p>

            <label className="mt-6 block" htmlFor="own-lyric">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Your invented line
              </span>
              <textarea
                id="own-lyric"
                value={text}
                maxLength={200}
                rows={4}
                onChange={(event) => {
                  setText(event.target.value);
                  setPlaying(false);
                }}
                className="w-full resize-none rounded-2xl border border-line-strong bg-[#08080a] p-4 text-base leading-relaxed text-white outline-none transition-colors placeholder:text-[#5f5f68] focus:border-white/30"
                placeholder={SAMPLE}
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span>{text.length}/200 · never sent or stored</span>
              <button
                type="button"
                className="btn btn-primary h-9 px-4 text-sm"
                onClick={() => setPlaying((value) => !value)}
                disabled={!text.trim()}
              >
                {playing ? "Pause all" : "Play all"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4" data-reveal>
            {previews.map((style) => (
              <div key={style.slug} className="own-text-card">
                <div className="own-text-stage">
                  <StyleCanvas
                    key={`${style.slug}-${text}-${playing}`}
                    style={style.renderer}
                    lines={lines}
                    palette={style.renderer.palette}
                    playing={playing}
                    loop
                    startAt={500}
                    durationMs={duration}
                    className="h-full w-full"
                    label={`${style.name} preview of your text`}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-[0.68rem] text-[#b9b9c2]">{style.name}</span>
                  <a href={`/playground?style=${style.slug}`} className="text-[0.62rem] text-muted hover:text-white">
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
