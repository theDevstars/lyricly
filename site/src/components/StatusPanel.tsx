import { useState, type CSSProperties } from "react";
import "../styles/status.css";

const checks = [
  {
    title: "Player is open",
    detail: "Lyrica looks for a Windows media session, not a specific app.",
  },
  {
    title: "Session is readable",
    detail: "The system exposes the title, artist and playback position.",
  },
  {
    title: "Something is playing",
    detail: "Paused apps still report their last track, so the title stays.",
  },
  {
    title: "Lyrics are timed",
    detail: "A timed record means every line can follow the song, not a guess.",
  },
];

export default function StatusPanel() {
  const [offset, setOffset] = useState(0);
  const display = offset === 0 ? "0 s" : `${offset > 0 ? "+" : "−"}${Math.abs(offset)} s`;

  const nudge = (delta: number) => {
    setOffset((value) => Math.max(-10, Math.min(10, value + delta)));
  };

  return (
    <section className="section border-t border-line" id="status" aria-labelledby="status-title">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow">Player status</p>
            <span className="badge">New in 2.0</span>
          </div>
          <h2 id="status-title" className="section-title">No lyrics? Now you can see why.</h2>
        </div>

        <div className="status-grid">
          <div className="status-mock" data-reveal>
            <div className="status-mock-inner">
              <div className="status-head">
                <div className="status-player">
                  <span className="status-player-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity=".5" />
                      <path d="M10 8.6 15.4 12 10 15.4V8.6Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span>
                    <span className="status-player-name">Spotify</span>
                    <span className="status-player-sub">Windows media session</span>
                  </span>
                </div>
                <span className="status-synced"><span className="status-synced-dot" />Synced</span>
              </div>

              <ul className="status-rows">
                <li>
                  <span className="status-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12" fill="none"><path d="m2.5 6 2.4 2.4L9.5 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="status-row-copy">
                    <span className="status-row-title">Player is open</span>
                    <span className="status-row-sub">Detected, running</span>
                  </span>
                </li>
                <li>
                  <span className="status-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12" fill="none"><path d="m2.5 6 2.4 2.4L9.5 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="status-row-copy">
                    <span className="status-row-title">Lyrica can read what&apos;s playing</span>
                    <span className="status-row-sub">Title, artist and position available</span>
                  </span>
                </li>
                <li>
                  <span className="status-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12" fill="none"><path d="m2.5 6 2.4 2.4L9.5 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="status-row-copy">
                    <span className="status-row-title">Playing &ldquo;Afterglow&rdquo;</span>
                    <span className="status-row-sub">Juniper Row · Slow Static</span>
                  </span>
                </li>
                <li>
                  <span className="status-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12" fill="none"><path d="m2.5 6 2.4 2.4L9.5 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="status-row-copy">
                    <span className="status-row-title">Lyrics found and timed</span>
                    <span className="status-row-sub">42 lines, matched line by line</span>
                  </span>
                </li>
              </ul>

              <div className="status-nudge">
                <div className="status-nudge-copy">
                  <p className="status-nudge-label">Timing nudge</p>
                  <p className="status-nudge-sub">This song only · resets on the next track</p>
                </div>
                <div className="status-nudge-controls">
                  <button type="button" className="status-nudge-btn" onClick={() => nudge(-1)} aria-label="Show lyrics one second earlier">
                    −1s
                  </button>
                  <output className="status-nudge-value" aria-live="polite" aria-atomic="true">{display}</output>
                  <button type="button" className="status-nudge-btn" onClick={() => nudge(1)} aria-label="Show lyrics one second later">
                    +1s
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="status-reset"
                onClick={() => setOffset(0)}
                disabled={offset === 0}
              >
                Reset offset
              </button>
            </div>
          </div>

          <div className="status-copy" data-reveal style={{ "--reveal-delay": "80ms" } as CSSProperties}>
            <p className="lead">
              Most lyric apps leave you guessing. Lyrica checks every step from &ldquo;a song is
              playing&rdquo; to &ldquo;the right line, on time&rdquo;, and tells you where it
              stopped.
            </p>

            <ul className="status-explain">
              {checks.map((check, index) => (
                <li key={check.title}>
                  <span className="status-explain-num">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="status-explain-title">{check.title}</span>
                    <span className="status-explain-detail">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="status-hint">
              Open it from the tray any time. If lyrics are missing, the first red row is the one
              to fix.
            </p>
          </div>
        </div>

        <div className="nudge-block" data-reveal>
          <div>
            <p className="eyebrow">Offset</p>
            <h3 className="nudge-title">Lyrics early or late? Nudge them.</h3>
          </div>
          <p className="nudge-copy">
            Some files are timed against a different master. Use the −1s and +1s buttons in the
            status panel to move the words until they land. The offset is saved for that song and
            clears automatically when the next track starts, so nothing drifts.
          </p>
        </div>
      </div>
    </section>
  );
}
