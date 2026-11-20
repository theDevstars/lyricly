import { useState, type FormEvent } from "react";
import siteConfig from "../../../site.config";

type Status = "idle" | "sending" | "done" | "error";

export default function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  if (!siteConfig.newsletter.enabled) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.includes("@")) {
      setStatus("error");
      return;
    }
    setStatus("sending");

    if (siteConfig.newsletter.formUrl) {
      try {
        const body = new FormData();
        body.append("email", email);
        body.append("consent", "monthly-updates");
        const response = await fetch(siteConfig.newsletter.formUrl, { method: "POST", body });
        setStatus(response.ok ? "done" : "error");
      } catch {
        setStatus("error");
      }
      return;
    }

    const subject = encodeURIComponent("Lyrica monthly updates");
    const body = encodeURIComponent(
      `Please add this address to the monthly Lyrica updates list.\n\n${email}\n\nI consent to one short update a month and understand I can unsubscribe in one click.`,
    );
    window.location.href = `mailto:${siteConfig.newsletter.email}?subject=${subject}&body=${body}`;
    setStatus("done");
  };

  return (
    <div>
      {status === "done" ? (
        <p className="rounded-xl border border-[#3ddc97]/25 bg-[#3ddc97]/8 px-3 py-2.5 text-xs leading-relaxed text-[#8fe3b9]" role="status">
          Thanks. If your mail app opened, send the draft and you are on the list. You can unsubscribe from any message.
        </p>
      ) : (
        <form className="newsletter-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="newsletter-email">Email for monthly Lyrica updates</label>
          <input
            id="newsletter-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="form-field flex-1"
          />
          <button type="submit" className="btn btn-primary h-11 px-4" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Get monthly updates"}
          </button>
        </form>
      )}
      <p className={`form-consent ${compact ? "mt-1.5" : "mt-2"}`}>
        {siteConfig.newsletter.consent}{" "}
        <a href={siteConfig.newsletter.privacyUrl}>Privacy</a>.
      </p>
      {status === "error" && <p className="mt-2 text-xs text-[#ff9dbb]" role="alert">That email did not look right. Try again, or write to {siteConfig.newsletter.email}.</p>}
    </div>
  );
}
