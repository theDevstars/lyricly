import { useCallback, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import "../styles/rimlight.css";

const features = [
  {
    title: "Any color you like",
    copy: "Pick two colors and blend them, or let the album artwork choose.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18h1.4a2.2 2.2 0 0 0 1.6-3.7 2.2 2.2 0 0 1 1.6-3.7H19A2.9 2.9 0 0 0 21 10 9 9 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="10" r="1.2" fill="currentColor" />
        <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
        <circle cx="16" cy="10" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Move, or stay still",
    copy: "Breathe with the song, drift slowly, or hold a perfectly still edge.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 17c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4" />
      </svg>
    ),
  },
  {
    title: "Dial the glow",
    copy: "From a crisp line to a soft spill that reaches across the desk.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Set the thickness",
    copy: "Two to twenty-four pixels, per display, without touching your wallpaper.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 8v6M11 8v6M15 8v6M19 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
        <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const rangeFill = (value: number, min: number, max: number) =>
  ({ "--pct": `${((value - min) / (max - min)) * 100}%` }) as CSSProperties;

export default function RimLight() {
  const reduceMotion = useReducedMotion() ?? false;
  const [enabled, setEnabled] = useState(true);
  const [gradient, setGradient] = useState("dual");
  const [animation, setAnimation] = useState("breathe");
  const [taskbar, setTaskbar] = useState(true);
  const [thickness, setThickness] = useState(12);
  const [glow, setGlow] = useState(62);
  const [overrideAlbum, setOverrideAlbum] = useState(true);
  const [colorA, setColorA] = useState("#FF5C8A");
  const [colorB, setColorB] = useState("#3FD6C8");
  const [display, setDisplay] = useState("Display 1");

  const rotateX = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (reduceMotion || event.pointerType !== "mouse") return;
      const rect = event.currentTarget.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      rotateY.set(px * 8);
      rotateX.set(-py * 7);
    },
    [reduceMotion, rotateX, rotateY],
  );

  const onLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const effectiveA = overrideAlbum ? colorA : "#7A6BFF";
  const effectiveB = overrideAlbum ? colorB : "#FF8FB1";
  const rimFill =
    gradient === "flat"
      ? `linear-gradient(135deg, ${effectiveA}, ${effectiveA})`
      : gradient === "soft"
        ? `radial-gradient(120% 120% at 20% 10%, ${effectiveA}, ${effectiveB})`
        : `linear-gradient(135deg, ${effectiveA} 0%, ${effectiveB} 100%)`;

  return (
    <section className="section rim-section" id="rim-light" aria-labelledby="rim-title">
      <div className="wrap">
        <div className="rim-head" data-reveal>
          <p className="eyebrow">Make it yours</p>
          <h2 id="rim-title" className="section-title">Make your screen your mood.</h2>
          <p className="lead">
            Light that leaves the song and lands on the edges of your display. Choose the color,
            the speed, how far it spills and how thick it sits. Everything updates while you drag.
          </p>
        </div>

        <div className="rim-layout">
          <div className="rim-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
            <motion.div
              className="rim-panel"
              style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 1200 }}
            >
              <div className="rim-panel-glow" aria-hidden="true" />
              <div className="rim-panel-head">
                <div className="rim-panel-title">
                  <span className="rim-panel-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3 9h18M3 15h18M7 5v14M17 5v14" stroke="currentColor" strokeWidth="1.5" opacity=".45" />
                    </svg>
                  </span>
                  <div>
                    <p className="rim-panel-name">Rim Light</p>
                    <p className="rim-panel-sub">Ambient edge lighting</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label="Turn Rim Light on or off"
                  className="rl-toggle"
                  data-on={enabled}
                  onClick={() => setEnabled((value) => !value)}
                >
                  <span className="rl-toggle-knob" />
                </button>
              </div>

              <div className="rim-controls" data-disabled={!enabled}>
                <div className="rl-row">
                  <label className="rl-label" htmlFor="rl-gradient">Gradient</label>
                  <select
                    id="rl-gradient"
                    className="rl-select"
                    value={gradient}
                    onChange={(event) => setGradient(event.target.value)}
                    disabled={!enabled}
                  >
                    <option value="dual">Dual tone</option>
                    <option value="soft">Soft blend</option>
                    <option value="flat">Flat color</option>
                  </select>
                </div>

                <div className="rl-row">
                  <label className="rl-label" htmlFor="rl-animation">Animation</label>
                  <select
                    id="rl-animation"
                    className="rl-select"
                    value={animation}
                    onChange={(event) => setAnimation(event.target.value)}
                    disabled={!enabled}
                  >
                    <option value="breathe">Breathe</option>
                    <option value="drift">Drift</option>
                    <option value="still">Still</option>
                  </select>
                </div>

                <div className="rl-row">
                  <div>
                    <p className="rl-label">Taskbar compatibility</p>
                    <p className="rl-hint">Let the glow sit under the taskbar</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={taskbar}
                    aria-label="Taskbar compatibility"
                    className="rl-toggle"
                    data-on={taskbar}
                    onClick={() => setTaskbar((value) => !value)}
                    disabled={!enabled}
                  >
                    <span className="rl-toggle-knob" />
                  </button>
                </div>

                <div className="rl-row rl-row-block">
                  <div className="rl-range-head">
                    <label className="rl-label" htmlFor="rl-thickness">Thickness</label>
                    <span className="rl-value">{thickness} px</span>
                  </div>
                  <input
                    id="rl-thickness"
                    className="rl-range"
                    type="range"
                    min={2}
                    max={24}
                    step={1}
                    value={thickness}
                    style={rangeFill(thickness, 2, 24)}
                    onChange={(event) => setThickness(Number(event.target.value))}
                    disabled={!enabled}
                  />
                </div>

                <div className="rl-row rl-row-block">
                  <div className="rl-range-head">
                    <label className="rl-label" htmlFor="rl-glow">Glow</label>
                    <span className="rl-value">{glow}%</span>
                  </div>
                  <input
                    id="rl-glow"
                    className="rl-range"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={glow}
                    style={rangeFill(glow, 0, 100)}
                    onChange={(event) => setGlow(Number(event.target.value))}
                    disabled={!enabled}
                  />
                </div>

                <div className="rl-row">
                  <div>
                    <p className="rl-label">Override album color</p>
                    <p className="rl-hint">{overrideAlbum ? "Using your palette" : "Following album artwork"}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={overrideAlbum}
                    aria-label="Override album color"
                    className="rl-toggle"
                    data-on={overrideAlbum}
                    onClick={() => setOverrideAlbum((value) => !value)}
                    disabled={!enabled}
                  >
                    <span className="rl-toggle-knob" />
                  </button>
                </div>

                <div className="rl-colors" data-muted={!overrideAlbum || !enabled}>
                  <label className="rl-color-row" htmlFor="rl-color-a">
                    <span className="rl-color-wheel">
                      <input
                        id="rl-color-a"
                        type="color"
                        value={colorA}
                        onChange={(event) => setColorA(event.target.value)}
                        disabled={!overrideAlbum || !enabled}
                      />
                    </span>
                    <span className="rl-color-meta">
                      <span className="rl-color-name">Color A</span>
                      <span className="rl-color-value">{effectiveA.toUpperCase()}</span>
                    </span>
                    <span className="rl-weight">60%</span>
                  </label>
                  <label className="rl-color-row" htmlFor="rl-color-b">
                    <span className="rl-color-wheel">
                      <input
                        id="rl-color-b"
                        type="color"
                        value={colorB}
                        onChange={(event) => setColorB(event.target.value)}
                        disabled={!overrideAlbum || !enabled}
                      />
                    </span>
                    <span className="rl-color-meta">
                      <span className="rl-color-name">Color B</span>
                      <span className="rl-color-value">{effectiveB.toUpperCase()}</span>
                    </span>
                    <span className="rl-weight">40%</span>
                  </label>
                </div>

                <div className="rl-row">
                  <label className="rl-label" htmlFor="rl-display">Display</label>
                  <select
                    id="rl-display"
                    className="rl-select"
                    value={display}
                    onChange={(event) => setDisplay(event.target.value)}
                    disabled={!enabled}
                  >
                    <option>Display 1</option>
                    <option>Display 2</option>
                    <option>All displays</option>
                  </select>
                </div>
              </div>

              <div className="rim-panel-foot">
                <span className="rim-saved">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="m2.2 6.2 2.4 2.4 5.2-5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Saved automatically
                </span>
                <span className="rim-panel-version">per display</span>
              </div>
            </motion.div>
          </div>

          <div className="rim-live">
            <div
              className="rl-desktop"
              data-anim={enabled ? animation : "off"}
              style={
                {
                  "--rim-fill": rimFill,
                  "--rim-thickness": `${thickness}px`,
                  "--rim-glow": `${glow}`,
                  "--rim-a": effectiveA,
                  "--rim-b": effectiveB,
                } as CSSProperties
              }
            >
              <div
                className="rl-glow"
                aria-hidden="true"
                style={{
                  background: rimFill,
                  filter: `blur(${glow * 0.5}px)`,
                  opacity: enabled ? Math.min(0.9, 0.12 + (glow / 100) * 0.72) : 0,
                }}
              />
              <div className="rl-bezel">
                <div className="rl-wall" style={{ backgroundImage: "url('/images/wallpaper.svg')" }}>
                  <div className="rl-window">
                    <div className="rl-window-top">
                      <span className="rl-window-dot" />
                      <span className="rl-window-title">Afterglow · Juniper Row</span>
                      <span className="rl-eq" aria-hidden="true">
                        <i /><i /><i /><i />
                      </span>
                    </div>
                    <p className="rl-lyric">and the room kept the color</p>
                    <p className="rl-lyric rl-lyric-muted">of a song we nearly lost</p>
                  </div>
                  <div className="rl-icons" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  <div className="rl-taskbar" data-taskbar={taskbar}>
                    <span className="rl-start" aria-hidden="true">
                      <i /><i /><i /><i />
                    </span>
                    <span className="rl-task-item">Lyrica</span>
                    <span className="rl-task-item rl-task-item-quiet">Explorer</span>
                    <span className="rl-clock">21:42</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="rl-caption">
              <span className="rl-caption-dot" />
              Live preview · {display} · {overrideAlbum ? "your palette" : "album palette"}
            </p>
          </div>
        </div>

        <div className="rim-features">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="rim-feature"
              data-spotlight
              data-reveal
              style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}
            >
              <span className="icon-tile">{feature.icon}</span>
              <h3 className="rim-feature-title">{feature.title}</h3>
              <p className="rim-feature-copy">{feature.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
