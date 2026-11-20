import { useEffect, useState } from "react";
import { tutorials, tutorialNote } from "../../data/tutorials";
import "../../styles/marketing.css";

export default function Tutorials() {
  const [openId, setOpenId] = useState<string | null>(null);
  const tutorial = tutorials.find((entry) => entry.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [openId]);

  return (
    <>
      <div className="page-card-grid">
        {tutorials.map((entry) => (
          <article key={entry.id} className="video-card">
            <div
              className="video-poster"
              style={{ "--video-a": entry.art[1], "--video-b": entry.art[0], "--video-c": entry.art[2] } as React.CSSProperties}
            >
              <button type="button" className="video-play" onClick={() => setOpenId(entry.id)} aria-label={`Play ${entry.title}, ${entry.duration}`}>
                <span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 2.2v9.6L12 7 4 2.2Z" /></svg>
                </span>
              </button>
              <span className="video-duration">{entry.duration}</span>
            </div>
            <div className="p-4">
              <h2 className="text-lg tracking-[-0.02em]">{entry.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{entry.description}</p>
              <p className="mt-3 text-[0.65rem] text-[#777781]">Captions: {entry.captions}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted">{tutorialNote}</p>

      {tutorial && (
        <div className="video-dialog" role="dialog" aria-modal="true" aria-labelledby="video-title" onClick={(event) => { if (event.target === event.currentTarget) setOpenId(null); }}>
          <div className="video-dialog-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Tutorial · {tutorial.duration}</p>
                <h2 id="video-title" className="mt-2 text-2xl tracking-[-0.03em]">{tutorial.title}</h2>
              </div>
              <button type="button" className="preview-close" onClick={() => setOpenId(null)} aria-label="Close tutorial">×</button>
            </div>

            {tutorial.embedUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                <iframe
                  src={tutorial.embedUrl}
                  title={tutorial.title}
                  loading="lazy"
                  allow="fullscreen; picture-in-picture"
                  className="aspect-video w-full"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
                <p className="text-sm font-semibold text-white">The captioned video is not published yet.</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{tutorial.captions}</p>
                <ol className="mt-4 grid gap-2 text-sm text-[#c9c9d0]">
                  {tutorial.chapters.map((chapter, index) => <li key={chapter}>{index + 1}. {chapter}</li>)}
                </ol>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href="/setup" className="btn btn-primary h-9 px-4 text-sm">Use the written guide</a>
                  <a href="/docs" className="btn btn-ghost h-9 px-4 text-sm">Read the docs</a>
                </div>
              </div>
            )}

            <p className="mt-4 text-[0.68rem] leading-relaxed text-muted">
              Nothing third-party loads until you press play. Captions are part of the published
              video, not an auto-generated afterthought.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
