import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { allStyles, styleGroups, type StyleItem } from "../../data/styles";
import { DEMO_DURATION_MS, DEMO_LINES } from "../../lib/demo";
import StyleCanvas from "../playground/StyleCanvas";
import "../../styles/gallery.css";

type OpenStyle = StyleItem | null;

export default function Gallery() {
  const [openStyle, setOpenStyle] = useState<OpenStyle>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenStyle(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!openStyle) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusables = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab" || !focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openStyle, close]);

  const open = (style: StyleItem, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setOpenStyle(style);
  };

  const accentIndex = openStyle ? allStyles.findIndex((s) => s.slug === openStyle.slug) + 1 : 0;

  return (
    <section className="section border-t border-line" id="styles" aria-labelledby="styles-title">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">Style gallery</p>
          <h2 id="styles-title" className="section-title">
            {allStyles.length} ways to say the same line.
          </h2>
          <p className="lead max-w-xl">
            Every style is drawn live, not a video loop. Hover one to see it move. Open it for the
            full frame, or take it straight into the playground.
          </p>
        </div>

        <div className="gallery-grid">
          {styleGroups.map((group, groupIndex) => (
            <div
              key={group.id}
              id={group.id}
              className="gallery-card"
              data-accent={group.accent || undefined}
              data-spotlight
              data-reveal
              style={{ "--reveal-delay": `${groupIndex * 90}ms` } as CSSProperties}
            >
              <div className="gallery-card-head">
                <div className="gallery-card-topline">
                  <span className="gallery-count">
                    {String(group.styles.length).padStart(2, "0")} styles
                  </span>
                  {group.isNew && <span className="badge">New</span>}
                </div>
                <h3 className="gallery-title">{group.title}</h3>
                <p className="gallery-subtitle">{group.subtitle}</p>
              </div>

              <div className="gallery-list">
                {group.styles.map((style) => (
                  <div
                    key={style.slug}
                    className="style-entry"
                    onPointerEnter={() => setActiveSlug(style.slug)}
                    onPointerLeave={() => setActiveSlug((current) => (current === style.slug ? null : current))}
                  >
                    <button
                      type="button"
                      className="style-row"
                      onClick={(event) => open(style, event.currentTarget)}
                      aria-haspopup="dialog"
                      aria-label={`Open a larger live preview of ${style.name}`}
                      onFocus={() => setActiveSlug(style.slug)}
                      onBlur={() => setActiveSlug((current) => (current === style.slug ? null : current))}
                    >
                      <span className="style-thumb" aria-hidden="true">
                        <StyleCanvas
                          style={style.renderer}
                          lines={DEMO_LINES}
                          palette={style.renderer.palette}
                          playing={!reduceMotion && activeSlug === style.slug}
                          loop
                          startAt={1750}
                          durationMs={DEMO_DURATION_MS}
                          className="style-thumb-canvas"
                          label=""
                        />
                      </span>
                      <span className="style-copy">
                        <span className="style-name">{style.name}</span>
                        <span className="style-desc">{style.description}</span>
                      </span>
                      <span className="style-arrow" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M4 10 10 4M5 4h5v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    <a href={`/playground?style=${style.slug}`} className="style-try">
                      Try in playground
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                ))}
              </div>

              {group.note && <p className="gallery-note">{group.note}</p>}
            </div>
          ))}
        </div>

        <p className="gallery-footnote" data-reveal>
          One style at a time, picked from the tray. Your choice is remembered per player. Preview
          lyrics and covers are invented.
        </p>
      </div>

      <AnimatePresence>
        {openStyle && (
          <motion.div
            className="preview-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <motion.div
              ref={dialogRef}
              className="preview-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="preview-title"
              aria-describedby="preview-desc"
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="preview-head">
                <div>
                  <p className="eyebrow">{openStyle.group}</p>
                  <h3 id="preview-title" className="preview-title">{openStyle.name}</h3>
                </div>
                <button type="button" className="preview-close" onClick={close} aria-label="Close preview">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="m2 2 10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="preview-stage" style={{ background: openStyle.gradient }}>
                <div className="preview-art">
                  <StyleCanvas
                    style={openStyle.renderer}
                    lines={DEMO_LINES}
                    palette={openStyle.renderer.palette}
                    playing={!reduceMotion}
                    loop
                    startAt={1750}
                    durationMs={DEMO_DURATION_MS}
                    className="preview-canvas"
                    label={`Live ${openStyle.name} preview with invented lyrics`}
                  />
                </div>
                <span className="preview-live">
                  <span className="preview-live-dot" />Live render
                </span>
              </div>

              <div className="preview-body">
                <p id="preview-desc" className="preview-desc">{openStyle.description}</p>
                <p className="preview-meta">
                  Style {String(accentIndex).padStart(2, "0")} of {allStyles.length} · Invented lyrics
                </p>
                <a href={`/playground?style=${openStyle.slug}`} className="btn btn-primary h-9 px-4 text-sm">
                  Try it in the playground
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
