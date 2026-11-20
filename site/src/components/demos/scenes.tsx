import type { CSSProperties } from "react";

type SceneProps = {
  lines: string[];
  active: number;
};

const starField = [
  [60, 70, 1.4], [130, 140, 1], [210, 54, 1.6], [292, 112, 1.1], [356, 62, 1.8],
  [430, 128, 1.2], [512, 58, 1.5], [598, 104, 1], [672, 48, 1.7], [742, 118, 1.3],
  [92, 236, 1.2], [178, 300, 1.5], [248, 214, 1], [330, 322, 1.3], [404, 246, 1.6],
  [486, 318, 1.1], [566, 240, 1.4], [640, 306, 1.2], [716, 214, 1.5], [780, 286, 1],
  [40, 330, 1.3], [120, 380, 1], [206, 350, 1.2], [292, 386, 1.4], [382, 350, 1],
  [470, 392, 1.3], [554, 356, 1.1], [634, 388, 1.5], [712, 352, 1.2], [776, 388, 1.4],
];

const constellationNodes = [
  [150, 300], [258, 196], [392, 250], [512, 130], [650, 206],
];

function routeFor(active: number) {
  const progress = Math.min(1, (active + 1) / 4);
  return { strokeDasharray: 1, strokeDashoffset: 1 - progress };
}

export function MessagesScene({ lines, active }: SceneProps) {
  return (
    <div className="scene scene-messages">
      <div className="ms-orbit ms-orbit-a" aria-hidden="true" />
      <div className="ms-orbit ms-orbit-b" aria-hidden="true" />
      <div className="ms-thread">
        <div className="ms-head">
          <div className="ms-avatar" aria-hidden="true">NV</div>
          <div className="ms-who">
            <p className="ms-name">Paper Satellites</p>
            <p className="ms-sub">Nova Vale · lyrics</p>
          </div>
          <span className="ms-live"><span className="ms-live-dot" />Playing</span>
        </div>
        <div className="ms-body">
          {lines.map((line, index) => (
            <div key={line} className="ms-row" data-on={index <= active}>
              <div>
                <p className="ms-bubble" data-fresh={index === active}>{line}</p>
              </div>
            </div>
          ))}
          <div className="ms-typing" data-off={active >= lines.length - 1} aria-hidden="true">
            <span /><span /><span />
          </div>
        </div>
        <p className="ms-foot">{active >= lines.length - 1 ? "Delivered" : "Lyrics sync in real time"}</p>
      </div>
    </div>
  );
}

export function MapScene({ lines, active }: SceneProps) {
  const current = lines[Math.max(0, active)];
  return (
    <div className="scene scene-map">
      <div className="map-canvas">
        <svg viewBox="0 0 800 450" className="map-svg" aria-hidden="true">
          <g className="map-blocks">
            <rect x="52" y="58" width="150" height="96" rx="10" />
            <rect x="236" y="44" width="118" height="120" rx="10" />
            <rect x="392" y="74" width="166" height="82" rx="10" />
            <rect x="596" y="46" width="130" height="112" rx="10" />
            <rect x="66" y="210" width="110" height="130" rx="10" />
            <rect x="214" y="196" width="176" height="98" rx="10" />
            <rect x="430" y="206" width="122" height="142" rx="10" />
            <rect x="590" y="204" width="150" height="96" rx="10" />
          </g>
          <g className="map-roads">
            <path d="M0 176 800 150" />
            <path d="M0 350 800 328" />
            <path d="M190 0 210 450" />
            <path d="M366 0 380 450" />
            <path d="M552 0 560 450" />
            <path d="M0 62 800 42" />
            <path d="M0 268 800 254" />
          </g>
          <path
            className="map-route-shadow"
            d="M112 392C186 356 168 292 246 272S352 292 380 232 420 138 508 122 606 130 682 84"
            pathLength={1}
            style={routeFor(active)}
          />
          <path
            className="map-route"
            d="M112 392C186 356 168 292 246 272S352 292 380 232 420 138 508 122 606 130 682 84"
            pathLength={1}
            style={routeFor(active)}
          />
          <g className="map-pin map-pin-start">
            <circle cx="112" cy="392" r="8" />
            <circle cx="112" cy="392" r="16" />
          </g>
          <g className="map-pin map-pin-end" data-on={active >= 2}>
            <circle cx="682" cy="84" r="9" />
            <circle cx="682" cy="84" r="20" />
          </g>
          <text x="86" y="430" className="map-label">Harbour Row</text>
          <text x="410" y="180" className="map-label">Foundry Ln</text>
          <text x="596" y="420" className="map-label">North Pier</text>
        </svg>

        <div className="map-top">
          <span className="map-chip"><span className="map-chip-dot" />Lyrics · live route</span>
          <span className="map-eta">{active >= 3 ? "Arrived" : `${1.2 - active * 0.3} km`}</span>
        </div>

        <div className="map-banner">
          <span className="map-turn" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M8 20V9.5A3.5 3.5 0 0 1 11.5 6H18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="m15 3 3.5 3-3.5 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="map-banner-copy">
            <p className="map-banner-eyebrow">Paper Satellites · Nova Vale</p>
            <p className="map-banner-line" key={current}>{current}</p>
          </div>
          <span className="map-banner-progress" aria-hidden="true">
            <span style={{ width: `${((active + 1) / 4) * 100}%` }} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function CodestyleScene({ lines, active }: SceneProps) {
  return (
    <div className="scene scene-code">
      <div className="code-window">
        <div className="code-tabs">
          <span className="code-tab is-active">
            <span className="code-dot code-dot-pink" />
            paper-satellites.ts
          </span>
          <span className="code-tab">notes.md</span>
          <span className="code-run">▶ run</span>
        </div>
        <div className="code-body">
          <div className="code-line">
            <span className="code-ln">1</span>
            <span className="code-plain">play({"{"}</span>
          </div>
          <div className="code-line">
            <span className="code-ln">2</span>
            <span className="code-indent code-prop">track:</span>
            <span className="code-str">"Paper Satellites"</span>
            <span className="code-plain">,</span>
          </div>
          {lines.map((line, index) => (
            <div
              className="code-line code-lyric"
              key={line}
              data-on={index <= active}
              data-live={index === active}
            >
              <span className="code-ln">{index + 3}</span>
              <span className="code-indent code-prop">lyric:</span>
              <span className="code-str">
                <span
                  className="code-typed"
                  style={{ "--chars": line.length } as CSSProperties}
                  key={`${line}-${active === index}`}
                >
                  "{line}"
                </span>
                {index === active && <span className="code-caret" aria-hidden="true" />}
              </span>
              <span className="code-plain">,</span>
            </div>
          ))}
          <div className="code-line">
            <span className="code-ln">{lines.length + 3}</span>
            <span className="code-plain">{"});"}<span className="code-caret code-caret-static" aria-hidden="true" /></span>
          </div>
        </div>
        <div className="code-status">
          <span>TypeScript · line {active + 3}</span>
          <span className="code-status-right"><span className="code-synced" />Synced to playback</span>
        </div>
      </div>
    </div>
  );
}

export function ConstellationScene({ lines, active }: SceneProps) {
  const current = lines[Math.max(0, active)];
  const visibleNodes = constellationNodes.slice(0, active + 2);
  return (
    <div className="scene scene-constellation">
      <svg viewBox="0 0 800 450" className="const-svg" aria-hidden="true">
        <g className="const-stars">
          {starField.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity={0.2 + ((i * 7) % 10) / 18} />
          ))}
        </g>
        <g className="const-links">
          {visibleNodes.slice(1).map((point, i) => {
            const prev = visibleNodes[i];
            return (
              <line
                key={`${point[0]}-${point[1]}`}
                x1={prev[0]}
                y1={prev[1]}
                x2={point[0]}
                y2={point[1]}
                className="const-link"
              />
            );
          })}
        </g>
        <g className="const-nodes">
          {constellationNodes.map(([x, y], i) => (
            <g key={`${x}-${y}`} data-on={i <= active + 1}>
              <circle cx={x} cy={y} r={8} className="const-halo" />
              <circle cx={x} cy={y} r={3.4} className="const-core" />
            </g>
          ))}
        </g>
      </svg>
      <div className="const-copy">
        <p className="const-eyebrow">Paper Satellites · Nova Vale</p>
        <p className="const-line" key={current}>{current}</p>
        <p className="const-count">{String(active + 1).padStart(2, "0")} / 04</p>
      </div>
    </div>
  );
}

export function SceneRenderer({ scene, lines, active }: SceneProps & { scene: number }) {
  switch (scene) {
    case 1:
      return <MapScene lines={lines} active={active} />;
    case 2:
      return <CodestyleScene lines={lines} active={active} />;
    case 3:
      return <ConstellationScene lines={lines} active={active} />;
    default:
      return <MessagesScene lines={lines} active={active} />;
  }
}
