import { useEffect, useState, type FormEvent } from "react";
import siteConfig from "../../../site.config";
import { assessRequirements, readWebglRenderer, type RequirementResult } from "../../lib/requirements";

type MailStatus = "idle" | "sending" | "done" | "error";

export default function RequirementsChecker() {
  const [result, setResult] = useState<RequirementResult | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<MailStatus>("idle");

  useEffect(() => {
    setResult(assessRequirements(navigator.userAgent, readWebglRenderer()));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.includes("@")) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    if (siteConfig.updates.formUrl) {
      try {
        const body = new FormData();
        body.append("email", email);
        const response = await fetch(siteConfig.updates.formUrl, { method: "POST", body });
        setStatus(response.ok ? "done" : "error");
      } catch {
        setStatus("error");
      }
      return;
    }
    const subject = encodeURIComponent("Lyrica for Windows — release news");
    const body = encodeURIComponent(`Please let me know when a Windows build is available.\n\n${email}`);
    window.location.href = `mailto:${siteConfig.updates.email}?subject=${subject}&body=${body}`;
    setStatus("done");
  };

  return (
    <div className="requirements-card" role="status" aria-live="polite">
      {!result ? (
        <p className="text-sm text-muted">Checking your browser…</p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className={`requirements-icon ${result.status}`} aria-hidden="true">
              {result.status === "ready" ? "✓" : result.status === "windows-only" ? "◐" : "!"}
            </span>
            <div>
              <h2 className="text-lg tracking-[-0.02em]">{result.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{result.message}</p>
            </div>
          </div>

          {result.status === "ready" && (
            <a href={siteConfig.download.windowsUrl} className="btn btn-primary mt-5 h-10 px-4" download>
              Download for Windows
            </a>
          )}

          {result.status === "windows-only" && (
            <div className="mt-5">
              {status === "done" ? (
                <p className="text-sm text-[#8fe3b9]">Thanks — check your mail app to send the draft.</p>
              ) : (
                <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor="checker-email">Email for Windows release news</label>
                  <input
                    id="checker-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="playground-search flex-1"
                  />
                  <button type="submit" className="btn btn-primary h-10 px-4" disabled={status === "sending"}>
                    {status === "sending" ? "Sending…" : "Notify me"}
                  </button>
                </form>
              )}
              <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">
                One email when a Windows build exists. No newsletter, no tracking. By submitting you
                consent to us storing your email for that one message.
              </p>
              {status === "error" && <p className="mt-2 text-xs text-[#ff9dbb]" role="alert">That email did not look right.</p>}
            </div>
          )}

          {result.webgl && (
            <details className="mt-5 border-t border-line pt-4 text-xs text-muted">
              <summary className="cursor-pointer select-none">Graphics renderer detected</summary>
              <p className="mt-2 break-words font-mono text-[0.68rem] text-[#b9b9c2]">{result.webgl}</p>
              <p className="mt-2">
                This check runs entirely in your browser. Nothing is sent to a server. Lyrica still
                needs Windows 10 2004+ and the WebView2 runtime.
              </p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
