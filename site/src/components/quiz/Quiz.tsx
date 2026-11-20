import { useEffect, useMemo, useRef, useState } from "react";
import { quizQuestions } from "../../data/quiz";
import { rankStyles } from "../../lib/quiz";
import { DEMO_DURATION_MS, DEMO_LINES } from "../../lib/demo";
import StyleCanvas from "../playground/StyleCanvas";
import "../../styles/quiz.css";

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const resultRef = useRef<HTMLCanvasElement>(null);

  const results = useMemo(() => (done ? rankStyles(answers) : []), [answers, done]);
  const question = quizQuestions[step];
  const progress = done ? 100 : Math.round((step / quizQuestions.length) * 100);

  useEffect(() => {
    if (!done || !resultRef.current) return;
    const canvas = resultRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const width = 1200;
    const height = 630;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);

    const paint = context.createLinearGradient(0, 0, width, height);
    paint.addColorStop(0, "#08080b");
    paint.addColorStop(0.62, "#170b16");
    paint.addColorStop(1, "#061418");
    context.fillStyle = paint;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(860, 130, 10, 860, 130, 440);
    glow.addColorStop(0, "rgba(255,92,138,0.3)");
    glow.addColorStop(1, "rgba(255,92,138,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,0.48)";
    context.font = '600 17px "Inter", system-ui, sans-serif';
    context.letterSpacing = "3px";
    context.fillText("LYRICA · STYLE RESULT", 64, 76);

    context.fillStyle = "#ffffff";
    context.font = '800 62px "Inter Tight", Inter, sans-serif';
    context.letterSpacing = "-2px";
    context.fillText("Your top three", 64, 154);

    context.fillStyle = "rgba(255,255,255,0.55)";
    context.font = '400 23px "Inter", system-ui, sans-serif';
    context.letterSpacing = "0px";
    context.fillText("A desktop lyric style mix based on five answers.", 64, 196);

    results.forEach((entry, index) => {
      const y = 274 + index * 108;
      const colors = entry.style.renderer.gradient;
      const swatch = context.createLinearGradient(64, y - 34, 170, y + 34);
      swatch.addColorStop(0, colors[0]);
      swatch.addColorStop(1, colors[1]);
      context.fillStyle = swatch;
      context.beginPath();
      context.roundRect(64, y - 34, 106, 68, 18);
      context.fill();

      context.fillStyle = "#ffffff";
      context.font = '700 28px "Inter Tight", Inter, sans-serif';
      context.letterSpacing = "-0.6px";
      context.fillText(`${index + 1}. ${entry.style.name}`, 196, y - 2);

      context.fillStyle = "rgba(255,255,255,0.5)";
      context.font = '400 17px "Inter", system-ui, sans-serif';
      context.fillText(entry.style.description.slice(0, 72), 196, y + 28);
    });

    context.fillStyle = "rgba(255,255,255,0.3)";
    context.font = '400 15px "Inter", system-ui, sans-serif';
    context.fillText("lyrica-avh2b6.freebuff.site/quiz · invented lyrics, not affiliated with Spotify, Apple or Cider", 64, 604);
  }, [done, results]);

  const choose = (optionId: string) => {
    const next = [...answers, optionId];
    setAnswers(next);
    if (step + 1 >= quizQuestions.length) {
      setDone(true);
    } else {
      setStep((value) => value + 1);
    }
  };

  const back = () => {
    if (step === 0) return;
    setStep((value) => value - 1);
    setAnswers((value) => value.slice(0, -1));
  };

  const retake = () => {
    setStep(0);
    setAnswers([]);
    setDone(false);
  };

  const download = () => {
    const canvas = resultRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "lyrica-style-result.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (done) {
    return (
      <div className="quiz-result" aria-live="polite">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="eyebrow">Your result</p>
            <h2 className="section-title mt-3.5">Start with these three.</h2>
            <p className="lead mt-4">
              Based on your answers, these give you a calm-to-loud range without repeating the
              same trick three times.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary h-10 px-4" onClick={download}>
                Download result card
              </button>
              <button type="button" className="btn btn-ghost h-10 px-4" onClick={retake}>
                Retake the quiz
              </button>
            </div>
            <a href="/#styles" className="mt-5 inline-flex text-sm text-muted underline decoration-white/25 underline-offset-2 hover:text-white">
              See every style
            </a>
          </div>
          <div className="quiz-card-preview">
            <canvas ref={resultRef} className="quiz-result-canvas" aria-label="Your top three Lyrica styles" role="img" />
          </div>
        </div>

        <div className="quiz-top-three">
          {results.map((entry, index) => (
            <article key={entry.style.slug} className="quiz-result-card">
              <div className="quiz-result-stage">
                <StyleCanvas
                  style={entry.style.renderer}
                  lines={DEMO_LINES}
                  palette={entry.style.renderer.palette}
                  playing
                  loop
                  startAt={1750}
                  durationMs={DEMO_DURATION_MS}
                  className="h-full w-full"
                  label={`${entry.style.name} result preview`}
                />
                <span className="quiz-rank">0{index + 1}</span>
              </div>
              <div className="p-4">
                <p className="eyebrow">{entry.style.group}</p>
                <h3 className="mt-2 text-xl tracking-[-0.03em]">{entry.style.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{entry.style.description}</p>
                <a href={`/playground?style=${entry.style.slug}`} className="btn btn-ghost mt-4 h-9 px-4 text-sm">
                  Try it in the playground
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz-progress" aria-label={`Question ${step + 1} of ${quizQuestions.length}`}>
        <div className="quiz-progress-head">
          <span>Question {step + 1} of {quizQuestions.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="quiz-progress-track"><span style={{ width: `${Math.max(6, ((step + 1) / quizQuestions.length) * 100)}%` }} /></div>
      </div>

      <div className="quiz-question">
        <p className="eyebrow">{question.hint}</p>
        <h2 className="mt-3 text-[clamp(1.8rem,4vw,2.7rem)] tracking-[-0.04em]">{question.question}</h2>
      </div>

      <div className="quiz-options" role="group" aria-labelledby="quiz-question">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="quiz-option"
            onClick={() => choose(option.id)}
          >
            <span className="quiz-glyph" aria-hidden="true">{option.glyph}</span>
            <span>
              <span className="block text-base font-semibold text-white">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{option.copy}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button type="button" className="btn btn-ghost h-9 px-4 text-sm" onClick={back} disabled={step === 0}>
          Back
        </button>
        <p className="text-xs text-muted">Five questions. No account, no storage.</p>
      </div>
    </div>
  );
}
