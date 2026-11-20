import { useState } from "react";
import "../../styles/playground.css";

export default function BeforeAfter() {
  const [split, setSplit] = useState(52);

  return (
    <section className="section border-t border-line" aria-labelledby="beforeafter-title">
      <div className="wrap">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div data-reveal>
            <p className="eyebrow">Desktop Scene</p>
            <h2 id="beforeafter-title" className="section-title mt-3.5">The same desk, with the lights on.</h2>
            <p className="lead mt-4">
              Drag the divider. On the left is a plain desktop; on the right, Desktop Scene and Rim
              Light add the words and a glow that follows the edges of the display.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
              <span className="brand-pill">Plain desktop</span>
              <span className="brand-pill">Desktop Scene + Rim Light</span>
            </div>
          </div>

          <div className="beforeafter" style={{ "--split": `${split}%` } as React.CSSProperties} data-reveal>
            <div className="ba-screen ba-plain" aria-hidden="true">
              <div className="ba-wall" />
              <div className="ba-icons"><i /><i /><i /><i /></div>
              <div className="ba-window">
                <span className="ba-window-dot" />
                <p>a quiet night</p>
                <span className="ba-window-line" />
                <span className="ba-window-line short" />
              </div>
              <div className="ba-taskbar"><i /><i /><i /><span /></div>
            </div>

            <div className="ba-screen ba-scene" aria-hidden="true">
              <div className="ba-wall ba-wall-lit" />
              <div className="ba-glow" />
              <div className="ba-icons"><i /><i /><i /><i /></div>
              <div className="ba-lyrics">
                <p className="ba-lyric-active">hold the quiet like a coin</p>
                <p>till the morning spends it</p>
              </div>
              <div className="ba-taskbar"><i /><i /><i /><span /></div>
            </div>

            <div className="ba-divider" aria-hidden="true">
              <span className="ba-handle">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4 2.5 8 6 12M10 4l3.5 4-3.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            <input
              type="range"
              min="8"
              max="92"
              value={split}
              onChange={(event) => setSplit(Number(event.target.value))}
              className="ba-range"
              aria-label="Reveal Desktop Scene and Rim Light over the plain desktop"
              aria-valuetext={`${split}% Desktop Scene`}
            />
            <span className="ba-label ba-label-left">Plain</span>
            <span className="ba-label ba-label-right">Desktop Scene</span>
          </div>
        </div>
      </div>
    </section>
  );
}
