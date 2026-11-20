import { useState } from "react";
import { setupChecklist, setupTabs } from "../../data/setup-guide";
import "../../styles/setup.css";

function StepArt({ kind }: { kind: string }) {
  return (
    <div className={`setup-art-mock setup-art-${kind}`} aria-hidden="true">
      <div className="setup-mock-window">
        <span className="setup-mock-dot" />
        <span className="setup-mock-line wide" />
        <span className="setup-mock-line" />
        <span className="setup-mock-line short" />
        <div className="setup-mock-lyrics">hold the quiet like a coin</div>
      </div>
      <div className="setup-mock-tray">
        <span>Lyrica</span>
        <i />
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const [tabId, setTabId] = useState(setupTabs[0].id);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const tab = setupTabs.find((entry) => entry.id === tabId) ?? setupTabs[0];
  const current = tab.steps[step];
  const progress = finished ? 100 : Math.round((step / tab.steps.length) * 100);

  const switchTab = (id: string) => {
    setTabId(id);
    setStep(0);
    setFinished(false);
    setChecked([]);
  };

  const toggleCheck = (index: number) => {
    setChecked((current) =>
      current.includes(index) ? current.filter((entry) => entry !== index) : [...current, index],
    );
  };

  return (
    <div className="setup-wizard">
      <div className="setup-tabs" role="tablist" aria-label="Choose your player">
        {setupTabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab.id === entry.id}
            className="setup-tab"
            onClick={() => switchTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{tab.blurb}</p>

      <div className="setup-progress mt-5">
        <div className="quiz-progress-head">
          <span>{finished ? "Final check" : `Step ${step + 1} of ${tab.steps.length}`}</span>
          <span>{progress}%</span>
        </div>
        <div className="quiz-progress-track"><span style={{ width: `${Math.max(5, finished ? 100 : ((step + 1) / tab.steps.length) * 100)}%` }} /></div>
      </div>

      {finished ? (
        <div className="setup-final" aria-live="polite">
          <p className="eyebrow">Did it work?</p>
          <h2 className="mt-2 text-[clamp(1.6rem,3.2vw,2.2rem)] tracking-[-0.03em]">Run the five-point check.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Open the tray status panel while a track is playing. You should be able to tick every
            line below. If one fails, the troubleshooter starts with the same question.
          </p>
          <ul className="setup-checklist">
            {setupChecklist.map((item, index) => (
              <li key={item}>
                <label>
                  <input type="checkbox" checked={checked.includes(index)} onChange={() => toggleCheck(index)} />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/troubleshoot" className="btn btn-primary h-10 px-4">Open the troubleshooter</a>
            <a href="https://discord.gg/AG7bJvtrrK" target="_blank" rel="noreferrer" className="btn btn-ghost h-10 px-4">Ask in Discord</a>
            <button type="button" className="btn btn-ghost h-10 px-4" onClick={() => { setFinished(false); setStep(0); setChecked([]); }}>
              Start over
            </button>
          </div>
        </div>
      ) : (
        <div className="setup-step" aria-live="polite">
          <div>
            <p className="eyebrow">{tab.label} · Step {step + 1}</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.2vw,2.2rem)] tracking-[-0.03em]">{current.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#b9b9c2]">{current.body}</p>
            {current.note && <p className="setup-note">{current.note}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost h-9 px-4 text-sm"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary h-9 px-4 text-sm"
                onClick={() => step + 1 >= tab.steps.length ? setFinished(true) : setStep((value) => value + 1)}
              >
                {step + 1 >= tab.steps.length ? "Did it work?" : "Next step"}
              </button>
            </div>
          </div>
          <StepArt kind={current.mock} />
        </div>
      )}

      <div className="setup-steps-list" aria-label="Setup steps">
        {tab.steps.map((entry, index) => (
          <button
            key={entry.title}
            type="button"
            className="setup-step-dot"
            aria-current={!finished && index === step ? "step" : undefined}
            onClick={() => { setFinished(false); setStep(index); }}
          >
            <span>0{index + 1}</span>
            {entry.title}
          </button>
        ))}
      </div>
    </div>
  );
}
