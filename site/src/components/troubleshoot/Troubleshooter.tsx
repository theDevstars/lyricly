import { useMemo, useState } from "react";
import treeData from "../../data/troubleshoot.json";
import siteConfig from "../../../site.config";
import "../../styles/troubleshoot.css";

type Leaf = {
  type: "leaf";
  title: string;
  fix: string;
  steps: string[];
  links: { label: string; href: string }[];
};
type Question = {
  type: "question";
  question: string;
  help: string;
  yes?: string;
  no?: string;
  options?: { label: string; next: string }[];
};
type Node = Leaf | Question;
type Tree = { start: string; nodes: Record<string, Node> };

const tree = treeData as Tree;

export default function Troubleshooter() {
  const [current, setCurrent] = useState(tree.start);
  const [history, setHistory] = useState<string[]>([]);
  const node = tree.nodes[current];

  const choose = (next: string) => {
    setHistory((value) => [...value, current]);
    setCurrent(next);
  };

  const back = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((value) => value.slice(0, -1));
    setCurrent(previous);
  };

  const reset = () => {
    setCurrent(tree.start);
    setHistory([]);
  };

  const progress = useMemo(() => Math.min(100, 24 + history.length * 22), [history.length]);

  if (!node) {
    return (
      <div className="troubleshoot-card">
        <p className="text-sm text-muted">That branch is missing. Start again.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={reset}>Start over</button>
      </div>
    );
  }

  return (
    <div className="troubleshoot-card" aria-live="polite">
      <div className="troubleshoot-progress">
        <span>Check {history.length + 1}</span>
        <span>{progress}%</span>
      </div>
      <div className="troubleshoot-progress-track"><span style={{ width: `${progress}%` }} /></div>

      {node.type === "question" ? (
        <div className="mt-6">
          <p className="eyebrow">Troubleshooter</p>
          <h2 className="mt-2 text-[clamp(1.7rem,4vw,2.5rem)] tracking-[-0.04em]">{node.question}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{node.help}</p>

          <div className="troubleshoot-options">
            {node.options ? (
              node.options.map((option) => (
                <button key={option.next} type="button" className="troubleshoot-option" onClick={() => choose(option.next)}>
                  <span>{option.label}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))
            ) : (
              <>
                <button type="button" className="troubleshoot-option" onClick={() => choose(node.yes!)}>
                  <span>Yes</span><span aria-hidden="true">→</span>
                </button>
                <button type="button" className="troubleshoot-option" onClick={() => choose(node.no!)}>
                  <span>No</span><span aria-hidden="true">→</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="eyebrow">One clear fix</p>
          <h2 className="mt-2 text-[clamp(1.7rem,4vw,2.5rem)] tracking-[-0.04em]">{node.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#c9c9d0]">{node.fix}</p>
          <ol className="troubleshoot-steps">
            {node.steps.map((step, index) => (
              <li key={step}><span>{index + 1}</span>{step}</li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            {node.links.map((link) => (
              <a key={link.href} href={link.href} className="btn btn-primary h-9 px-4 text-sm">
                {link.label}
              </a>
            ))}
            <button type="button" className="btn btn-ghost h-9 px-4 text-sm" onClick={reset}>Start over</button>
          </div>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-line pt-5 text-xs text-muted">
        <button type="button" onClick={back} disabled={history.length === 0} className="disabled:opacity-40">
          ← Back
        </button>
        <a href="/faq" className="hover:text-white">Full FAQ</a>
        <a href={siteConfig.discord.inviteUrl} target="_blank" rel="noreferrer" className="hover:text-white">Discord</a>
        <span className="ml-auto">Copy diagnostics from the tray status panel.</span>
      </div>
    </div>
  );
}
