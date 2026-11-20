import { useEffect, useState, type FormEvent } from "react";
import siteConfig from "../../../site.config";
import "../../styles/download.css";

type Platform = "unknown" | "windows" | "other";
type Status = "idle" | "sending" | "done" | "error";

export default function DownloadButton() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const ua = navigator.userAgent;
    const isWindows = /Windows/i.test(ua);
    setPlatform(isWindows ? "windows" : "other");
  }, []);

  const priceTag = siteConfig.product.kind === "free" ? "Free" : siteConfig.pricing.priceLabel;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !email.includes("@")) {
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

    const subject = encodeURIComponent("Lyrica for Windows — tell me when it lands");
    const body = encodeURIComponent(`Please let me know when Lyrica is available on Windows.\n\n${email}`);
    window.location.href = `mailto:${siteConfig.updates.email}?subject=${subject}&body=${body}`;
    setStatus("done");
  };

  if (platform === "other") {
    return (
      <div className="download-alt">
        <p className="download-alt-title">Windows only for now</p>
        <p className="download-alt-copy">
          Lyrica is a Windows tray app. There is no macOS or Linux build yet, and we would rather
          say so than hand you a broken file.
        </p>

        {status === "done" ? (
          <p className="download-alt-done" role="status">
            Thanks. If your mail app opened, send the draft and you are on the list.
          </p>
        ) : (
          <form className="download-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="updates-email">
              Email address for Windows release news
            </label>
            <input
              id="updates-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="download-input"
              aria-describedby="updates-hint"
              required
            />
            <button type="submit" className="btn btn-primary download-submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Notify me"}
            </button>
          </form>
        )}

        <p id="updates-hint" className="download-hint">
          One email when a Windows build exists. No newsletter, no tracking.
        </p>
        {status === "error" && (
          <p className="download-error" role="alert">
            That email did not look right. Try again, or write to {siteConfig.updates.email}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="download-main">
      <a href={siteConfig.download.windowsUrl} className="btn btn-primary download-button" download>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M7 1.4v8.1L4.2 6.7 3 8l5 5 5-5-1.2-1.3L9 9.5V1.4H7ZM2 13h12v1.6H2V13Z" />
        </svg>
        {siteConfig.pricing.ctaLabel}
        <span className="price-tag">{priceTag}</span>
      </a>
      <p className="download-meta">
        {siteConfig.download.sizeLabel} · Windows 10 2004+ / 11 · Version {siteConfig.product.version}
      </p>
      <p className="download-license">
        <a href="/account">Sign in with Discord</a>
        <span>· required to download</span>
      </p>
    </div>
  );
}
