import { useEffect, useMemo, useState } from "react";
import type { FaqItem } from "../../data/faq";
import { searchFaq } from "../../lib/faq";
import "../../styles/faq.css";

type Props = { items: FaqItem[] };

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="faq-mark">{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function FaqBrowser({ items }: Props) {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string>(items[0]?.slug ?? "");

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace("#", ""));
    if (hash && items.some((item) => item.slug === hash)) setOpenSlug(hash);
  }, [items]);

  const filtered = useMemo(() => searchFaq(items, query), [items, query]);

  const toggle = (item: FaqItem) => {
    const next = openSlug === item.slug ? "" : item.slug;
    setOpenSlug(next);
    if (next) {
      history.replaceState(null, "", `#${item.slug}`);
    } else {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  return (
    <div className="faq-browser">
      <div className="faq-toolbar">
        <label className="faq-search-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Search the FAQ</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions, answers and limits"
            className="faq-search"
          />
        </label>
        <span className="faq-count" role="status" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "answer" : "answers"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="faq-empty">
          <p className="font-display text-xl font-bold text-white">No answer matches that.</p>
          <p className="mt-2 text-sm text-muted">Try a player name, “late”, “fullscreen”, “key” or “uninstall”.</p>
        </div>
      ) : (
        <div className="faq-results">
          {filtered.map((item) => {
            const open = openSlug === item.slug;
            return (
              <article key={item.slug} id={item.slug} className={`faq-result ${open ? "is-open" : ""}`}>
                <h2>
                  <button
                    type="button"
                    className="faq-result-trigger"
                    aria-expanded={open}
                    aria-controls={`answer-${item.slug}`}
                    onClick={() => toggle(item)}
                  >
                    <span className="faq-result-category">{item.category}</span>
                    <span className="faq-result-question">
                      <Highlight text={item.question} query={query} />
                    </span>
                    <span className="faq-plus" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                </h2>
                <div id={`answer-${item.slug}`} className="faq-result-panel" hidden={!open}>
                  <p className="faq-result-answer">
                    <Highlight text={item.answer} query={query} />
                  </p>
                  <button
                    type="button"
                    className="faq-link"
                    onClick={async () => {
                      const url = `${window.location.origin}${window.location.pathname}#${item.slug}`;
                      try {
                        await navigator.clipboard.writeText(url);
                      } catch {
                        window.prompt("Copy this link", url);
                      }
                    }}
                  >
                    Copy link to this answer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
