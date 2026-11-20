import { useEffect, useMemo, useState } from "react";
import {
  setupModeration,
  setupPlayers,
  setupScreens,
  setupStyles,
  type SetupEntry,
} from "../../data/setups";
import "../../styles/marketing.css";

function SetupArt({ setup, large = false }: { setup: SetupEntry; large?: boolean }) {
  return (
    <div
      className={large ? "setup-lightbox-art" : "setup-art"}
      style={{ "--setup-a": setup.art[1], "--setup-b": setup.art[0], "--setup-c": setup.art[2] } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="setup-preview-badge">{setup.preview ? "Preview setup" : "Community setup"}</span>
      <div className="setup-art-screen">
        <span className="setup-art-line" />
        <span className="setup-art-line" />
        <span className="setup-art-line" />
        <span className="setup-art-taskbar" />
      </div>
    </div>
  );
}

export default function SetupsGallery({ entries }: { entries: SetupEntry[] }) {
  const [style, setStyle] = useState("all");
  const [player, setPlayer] = useState("all");
  const [screens, setScreens] = useState("all");
  const [open, setOpen] = useState<SetupEntry | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (style === "all" || entry.style === style) &&
          (player === "all" || entry.player === player) &&
          (screens === "all" || String(entry.screens) === screens),
      ),
    [entries, player, screens, style],
  );

  const reset = () => {
    setStyle("all");
    setPlayer("all");
    setScreens("all");
  };

  return (
    <>
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-3.5 sm:grid-cols-3">
        <label className="grid gap-1 text-[0.65rem] text-muted">
          Style
          <select className="form-field" value={style} onChange={(event) => setStyle(event.target.value)}>
            <option value="all">All styles</option>
            {setupStyles.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[0.65rem] text-muted">
          Player
          <select className="form-field" value={player} onChange={(event) => setPlayer(event.target.value)}>
            <option value="all">All players</option>
            {setupPlayers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[0.65rem] text-muted">
          Screens
          <select className="form-field" value={screens} onChange={(event) => setScreens(event.target.value)}>
            <option value="all">Any number</option>
            {setupScreens.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{filtered.length} {filtered.length === 1 ? "setup" : "setups"}</span>
        <button type="button" className="hover:text-white" onClick={reset}>Reset filters</button>
      </div>

      {filtered.length > 0 ? (
        <div className="setup-grid mt-4">
          {filtered.map((entry) => (
            <button key={entry.id} type="button" className="setup-card" onClick={() => setOpen(entry)}>
              <SetupArt setup={entry} />
              <div className="setup-card-body text-left">
                <p className="setup-card-title">{entry.title}</p>
                <p className="setup-card-meta">{entry.style} · {entry.player} · {entry.screens} {entry.screens === 1 ? "screen" : "screens"}</p>
                <p className="mt-1.5 line-clamp-2 text-[0.65rem] leading-relaxed text-muted">{entry.caption}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          No setup matches those filters. <button type="button" className="text-white underline underline-offset-2" onClick={reset}>Reset them</button>.
        </div>
      )}

      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted">{setupModeration}</p>

      {open && (
        <div
          className="setup-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="setup-detail-title"
          onClick={(event) => { if (event.target === event.currentTarget) setOpen(null); }}
        >
          <div className="setup-lightbox-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{open.preview ? "Generated preview" : "Community setup"} · {open.date}</p>
                <h2 id="setup-detail-title" className="mt-2 text-2xl tracking-[-0.03em]">{open.title}</h2>
              </div>
              <button type="button" className="preview-close" onClick={() => setOpen(null)} aria-label="Close setup">×</button>
            </div>
            <div className="mt-4"><SetupArt setup={open} large /></div>
            <p className="mt-4 text-sm leading-relaxed text-[#c9c9d0]">{open.caption}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface p-2.5"><dt className="text-muted">Style</dt><dd className="mt-0.5 text-white">{open.style}</dd></div>
              <div className="rounded-lg border border-line bg-surface p-2.5"><dt className="text-muted">Player</dt><dd className="mt-0.5 text-white">{open.player}</dd></div>
              <div className="rounded-lg border border-line bg-surface p-2.5"><dt className="text-muted">Screens</dt><dd className="mt-0.5 text-white">{open.screens}</dd></div>
            </dl>
            <p className="mt-4 text-[0.68rem] leading-relaxed text-muted">
              {open.preview
                ? "This is an illustrative preview generated for the site, not a photograph of a submitted desk. Approved community photos will carry the creator's credit and a link."
                : `Credit: ${open.credit}`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
