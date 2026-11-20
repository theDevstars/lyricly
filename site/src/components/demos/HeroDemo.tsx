import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { subscribe } from "../../lib/ticker";
import { demoLines, sceneNames } from "./lyrics";
import { SceneRenderer } from "./scenes";
import "../../styles/demo.css";

const SCENE_SECONDS = 11;
const LINE_SECONDS = 2.4;

export default function HeroDemo() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [scene, setScene] = useState(0);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);

  const playingRef = useRef(true);
  const visibleRef = useRef(true);
  const sceneRef = useRef(0);
  const activeRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduceMotion(query.matches);
      if (query.matches) {
        setPlaying(false);
        playingRef.current = false;
        setActive(demoLines.length - 1);
        activeRef.current = demoLines.length - 1;
      }
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Pause when the demo scrolls out of view.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "80px 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Shared page-wide rAF loop.
  useEffect(() => {
    if (reduceMotion) return;
    return subscribe((_elapsed, delta) => {
      if (!playingRef.current || !visibleRef.current) return;
      timeRef.current += delta;
      const local = timeRef.current % SCENE_SECONDS;
      const nextScene = Math.floor(timeRef.current / SCENE_SECONDS) % sceneNames.length;
      const nextActive = Math.min(demoLines.length - 1, Math.floor(local / LINE_SECONDS));

      if (nextScene !== sceneRef.current) {
        sceneRef.current = nextScene;
        setScene(nextScene);
      }
      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
    });
  }, [reduceMotion]);

  const chooseScene = useCallback(
    (index: number) => {
      // Align the shared clock with the chosen scene so autoplay does not snap back.
      timeRef.current = index * SCENE_SECONDS;
      sceneRef.current = index;
      const nextActive = reduceMotion ? demoLines.length - 1 : 0;
      activeRef.current = nextActive;
      setScene(index);
      setActive(nextActive);
      if (!reduceMotion) {
        setPlaying(true);
        playingRef.current = true;
      }
    },
    [reduceMotion],
  );

  // "See it in action" in the showcase section restarts this demo.
  useEffect(() => {
    const restart = () => {
      chooseScene(0);
      frameRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    };
    window.addEventListener("lyrica:play-demo", restart);
    return () => window.removeEventListener("lyrica:play-demo", restart);
  }, [chooseScene, reduceMotion]);

  const togglePlaying = () => {
    if (reduceMotion) return;
    const next = !playing;
    setPlaying(next);
    playingRef.current = next;
  };

  return (
    <div className="hero-demo" data-reduced={reduceMotion}>
      <div className="demo-frame" ref={frameRef} data-playing={playing && !reduceMotion}>
        <div className="demo-titlebar">
          <div className="demo-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <p className="demo-window-title">
            Lyrica <span aria-hidden="true">·</span>{" "}
            <span className="demo-window-muted">now playing</span>
          </p>
          <span className="demo-synced"><span className="demo-synced-dot" />Synced</span>
        </div>

        <div className="demo-stage">
          <div key={scene} className="demo-scene-layer demo-scene-enter">
            <SceneRenderer scene={scene} lines={demoLines} active={active} />
          </div>
          <div className="demo-vignette" aria-hidden="true" />
        </div>

        <div className="demo-footer">
          <div className="demo-art" aria-hidden="true">PS</div>
          <div className="demo-track">
            <p className="demo-track-title">Paper Satellites</p>
            <p className="demo-track-artist">Nova Vale · Night Signals</p>
          </div>
          <div className="demo-eq" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span key={bar} style={{ "--i": bar } as CSSProperties} />
            ))}
          </div>
          <span className="demo-style-name">{sceneNames[scene]}</span>
        </div>
      </div>

      <div className="demo-controls">
        <button
          type="button"
          className="demo-play"
          onClick={togglePlaying}
          aria-pressed={!playing}
          aria-label={
            reduceMotion
              ? "Static preview shown because reduced motion is on"
              : playing
                ? "Pause style preview"
                : "Play style preview"
          }
          disabled={reduceMotion}
        >
          {reduceMotion ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1.5" y="1.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          ) : playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M3 1.6 10 6l-7 4.4V1.6Z" />
            </svg>
          )}
          {reduceMotion ? "Static preview" : playing ? "Pause" : "Play"}
        </button>

        <div className="demo-tabs" role="group" aria-label="Choose a preview style">
          {sceneNames.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-pressed={scene === index}
              className="demo-tab"
              data-active={scene === index}
              onClick={() => chooseScene(index)}
            >
              {name}
            </button>
          ))}
        </div>

        <span className="badge demo-new">New in 2.0</span>
      </div>

      <p className="demo-caption">
        Style previews use an invented song and invented lyrics. Toggle a style above to see it
        from the top.
      </p>
    </div>
  );
}
