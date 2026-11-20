import { useCallback, useEffect, useMemo, useState } from "react";
import siteConfig from "../../../site.config";
import { allStyles, styleGroups } from "../../data/styles";
import {
  DEMO_COVERS,
  DEMO_DURATION_MS,
  DEMO_LINES,
  DEMO_SONG,
} from "../../lib/demo";
import {
  DEFAULT_PLAYGROUND,
  PLAYGROUND_FONTS,
  decodePlaygroundState,
  encodePlaygroundState,
  type PlaygroundState,
} from "../../lib/playground-state";
import StyleCanvas from "./StyleCanvas";
import "../../styles/playground.css";

type Props = {
  compact?: boolean;
  initialStyle?: string;
};

const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function Playground({ compact = false, initialStyle }: Props) {
  const [state, setState] = useState<PlaygroundState>({
    ...DEFAULT_PLAYGROUND,
    style: initialStyle || DEFAULT_PLAYGROUND.style,
  });
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(DEFAULT_PLAYGROUND.position);
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const parsed = decodePlaygroundState(window.location.search);
    setState(parsed);
    setPosition(parsed.position);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    url.search = encodePlaygroundState(state);
    window.history.replaceState({}, "", url);
  }, [state, ready]);

  useEffect(() => {
    const onCycle = (event: Event) => {
      const slug = (event as CustomEvent<{ slug?: string }>).detail?.slug;
      if (slug && allStyles.some((style) => style.slug === slug)) {
        setState((current) => ({ ...current, style: slug }));
      }
    };
    window.addEventListener("lyrica:cycle-style", onCycle);
    return () => window.removeEventListener("lyrica:cycle-style", onCycle);
  }, []);

  const selected = allStyles.find((style) => style.slug === state.style) ?? allStyles[0];
  const cover = DEMO_COVERS.find((entry) => entry.id === state.cover) ?? DEMO_COVERS[0];
  const font = PLAYGROUND_FONTS.find((entry) => entry.id === state.font) ?? PLAYGROUND_FONTS[0];

  const palette = useMemo(() => {
    if (selected.colorMode === "fixed") return selected.renderer.palette;
    if (state.autoSync) {
      return {
        accent: cover.colors[0],
        text: "#ffffff",
        dim: `${cover.colors[1]}99`,
        background: cover.colors[2],
      };
    }
    return {
      accent: state.highlight,
      text: state.text,
      dim: state.secondary,
      background: "#050506",
    };
  }, [cover, selected, state.autoSync, state.highlight, state.secondary, state.text]);

  const update = (patch: Partial<PlaygroundState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return styleGroups
      .map((group) => ({
        ...group,
        styles: group.styles.filter((style) =>
          !needle
            ? true
            : `${style.name} ${style.description} ${style.group} ${style.traits.moods.join(" ")}`
                .toLowerCase()
                .includes(needle),
        ),
      }))
      .filter((group) => group.styles.length > 0);
  }, [query]);

  const onPosition = useCallback((next: number) => setPosition(next), []);

  const seek = (next: number) => {
    setPosition(next);
    setSeekTo(next);
    update({ position: next });
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.search = encodePlaygroundState({ ...state, position });
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied("Link copied");
    } catch {
      setCopied("Copy the address bar to share");
    }
    window.setTimeout(() => setCopied(""), 2400);
  };

  return (
    <div className={`playground ${compact ? "playground-compact" : ""}`}>
      <div className="playground-stage-column">
        <div
          className={`playground-stage ${state.glow ? "is-glowing" : ""}`}
          style={
            state.glow
              ? {
                  boxShadow: `0 0 ${state.thickness * 2.2}px ${state.glowColor}66, 0 0 ${state.thickness}px ${state.glowColor}55`,
                }
              : undefined
          }
          data-backdrop={state.backdrop}
        >
          <div className="playground-stage-art" aria-hidden="true" />
          <StyleCanvas
            key={`${selected.slug}-${state.font}-${state.autoSync}`}
            style={selected.renderer}
            lines={DEMO_LINES}
            palette={palette}
            playing={playing}
            loop
            startAt={position}
            seekTo={seekTo}
            durationMs={DEMO_DURATION_MS}
            fontFamily={font.stack}
            fontScale={state.size}
            tracks={{ ...DEMO_SONG, app: "Lyrica preview" }}
            label={`${selected.name} style preview with invented lyrics from Paper Lanterns`}
            onPosition={onPosition}
            className="playground-canvas"
          />
          <div className="playground-stage-meta">
            <span className="playground-live"><i aria-hidden="true" /> Live renderer</span>
            <span>{selected.name}</span>
            <span className="playground-track">{DEMO_SONG.title} · {DEMO_SONG.artist}</span>
          </div>
        </div>

        <div className="playground-transport" aria-label="Playback controls">
          <button
            type="button"
            className="playground-play"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3" height="10" rx="1" /><rect x="8" y="2" width="3" height="10" rx="1" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 2.2v9.6L12 7 4 2.2Z" /></svg>
            )}
          </button>
          <span className="playground-time">{formatTime(position)}</span>
          <input
            type="range"
            min="0"
            max={DEMO_DURATION_MS}
            step="50"
            value={Math.min(position, DEMO_DURATION_MS)}
            onChange={(event) => seek(Number(event.target.value))}
            className="playground-range"
            aria-label="Scrub the invented demo track"
          />
          <span className="playground-time">{formatTime(DEMO_DURATION_MS)}</span>
          <a href={siteConfig.download.windowsUrl} className="btn btn-primary h-9 px-4 text-sm" download>
            Download the app
          </a>
        </div>

        {!compact && (
          <div className="playground-actions">
            <button type="button" className="btn btn-ghost h-9 px-4 text-sm" onClick={share}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 6.5 9 4M5 7.5 9 10M10.5 3.2a1.7 1.7 0 1 0 0-.1M3.5 7a1.7 1.7 0 1 0 0-.1M10.5 10.8a1.7 1.7 0 1 0 0-.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              Share this look
            </button>
            <span className="playground-share-status" role="status" aria-live="polite">{copied}</span>
            <a href="/faq" className="text-xs text-muted transition-colors hover:text-white">Why are lyrics missing?</a>
          </div>
        )}
      </div>

      <div className="playground-controls">
        <div className="playground-picker-head">
          <div>
            <p className="eyebrow">Style</p>
            <p className="mt-2 text-sm text-muted">{styleGroups.reduce((sum, group) => sum + group.styles.length, 0)} styles, all drawn live.</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search styles"
            className="playground-search"
            aria-label="Search styles"
          />
        </div>

        <div className="playground-picker" role="group" aria-label="Choose a lyric style">
          {filteredGroups.map((group) => (
            <div key={group.id} className="playground-group">
              <p className="playground-group-title">{group.title}</p>
              <div className="playground-style-grid">
                {group.styles.map((style) => (
                  <button
                    key={style.slug}
                    type="button"
                    className="playground-style-option"
                    aria-pressed={style.slug === selected.slug}
                    onClick={() => update({ style: style.slug })}
                  >
                    <span className="playground-swatch" style={{ background: style.gradient }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8rem] font-medium text-white">{style.name}</span>
                      <span className="block truncate text-[0.68rem] text-muted">{style.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredGroups.length === 0 && <p className="p-4 text-sm text-muted">No style matches that search.</p>}
        </div>

        <div className="playground-control-grid">
          <label className="playground-control">
            <span className="playground-label">Text size <b>{Math.round(state.size * 100)}%</b></span>
            <input type="range" min="0.75" max="1.6" step="0.05" value={state.size} onChange={(event) => update({ size: Number(event.target.value) })} className="playground-range" />
          </label>

          <label className="playground-control">
            <span className="playground-label">Font</span>
            <select value={state.font} onChange={(event) => update({ font: event.target.value as PlaygroundState["font"] })} className="playground-select">
              {PLAYGROUND_FONTS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
        </div>

        {!compact && (
          <>
            <div className="playground-control">
              <span className="playground-label">Auto Sync</span>
              <div className="playground-covers">
                {DEMO_COVERS.map((entry) => (
                  <button key={entry.id} type="button" className="playground-cover" aria-pressed={state.autoSync && state.cover === entry.id} onClick={() => update({ autoSync: true, cover: entry.id })}>
                    <span style={{ background: `linear-gradient(135deg, ${entry.colors[0]}, ${entry.colors[1]} 55%, ${entry.colors[2]})` }} aria-hidden="true" />
                    {entry.name}
                  </button>
                ))}
                <button type="button" className="playground-cover" aria-pressed={!state.autoSync} onClick={() => update({ autoSync: false })}>
                  <span className="playground-cover-custom" aria-hidden="true" />
                  Your colors
                </button>
              </div>
            </div>

            <div className="playground-control-grid">
              {[
                { key: "text" as const, label: "Lyric text" },
                { key: "highlight" as const, label: "Highlight" },
                { key: "secondary" as const, label: "Secondary" },
              ].map((well) => (
                <label key={well.key} className="playground-color">
                  <span>{well.label}</span>
                  <input
                    type="color"
                    value={state[well.key]}
                    disabled={state.autoSync || selected.colorMode === "fixed"}
                    onChange={(event) => update({ [well.key]: event.target.value, autoSync: false })}
                    aria-label={`${well.label} color`}
                  />
                </label>
              ))}
            </div>

            <div className="playground-control-grid">
              <label className="playground-control">
                <span className="playground-label">Backdrop</span>
                <select value={state.backdrop} onChange={(event) => update({ backdrop: event.target.value as PlaygroundState["backdrop"] })} className="playground-select" disabled={selected.background === "own"}>
                  <option value="black">Black</option>
                  <option value="blur">Blurred art</option>
                  <option value="gradient">Gradient</option>
                </select>
                {selected.background === "own" && <span className="playground-hint">This style paints its own scene.</span>}
              </label>

              <div className="playground-control">
                <span className="playground-label">Edge glow</span>
                <div className="playground-toggle-row">
                  <button type="button" className="playground-toggle" aria-pressed={state.glow} onClick={() => update({ glow: !state.glow })}>
                    {state.glow ? "On" : "Off"}
                  </button>
                  <input type="color" value={state.glowColor} onChange={(event) => update({ glowColor: event.target.value })} aria-label="Edge glow color" />
                  <input type="range" min="0" max="48" step="1" value={state.thickness} onChange={(event) => update({ thickness: Number(event.target.value) })} aria-label="Edge glow thickness" className="playground-range" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
