import { useEffect, useState } from "react";
import "../../styles/account.css";

type Viewer = {
  name: string | null;
  avatar: string | null;
};

type License = {
  key: string;
  id: string;
  recipient: string;
  issuedAt: number;
  expiresAt: number | null;
  plan: string;
};

type State =
  | { status: "loading" }
  | { status: "signedOut"; configured: boolean }
  | { status: "ready"; viewer: Viewer; license: License | null }
  | { status: "error"; message: string };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function AccountPanel() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;

    const load = async () => {
      try {
        const session = await fetch("/api/session", {
          headers: { Accept: "application/json" },
        });
        if (!session.ok) throw new Error("Could not check your session.");

        const sessionData = (await session.json()) as {
          user?: Viewer | null;
          discordConfigured?: boolean;
        };
        if (!live) return;

        if (!sessionData.user) {
          setState({ status: "signedOut", configured: sessionData.discordConfigured !== false });
          return;
        }

        const account = await fetch("/api/account", {
          headers: { Accept: "application/json" },
        });
        if (!live) return;

        if (account.status === 401) {
          setState({ status: "signedOut", configured: true });
          return;
        }
        if (!account.ok) throw new Error("Could not load your license.");

        const accountData = (await account.json()) as {
          user: Viewer;
          license: License | null;
        };
        if (!live) return;

        setState({
          status: "ready",
          viewer: accountData.user,
          license: accountData.license,
        });
      } catch (error) {
        if (!live) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    };

    void load();
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const claim = async () => {
    setClaiming(true);
    setClaimError(null);

    try {
      const response = await fetch("/api/license", {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        setState({ status: "signedOut", configured: true });
        return;
      }
      if (!response.ok) throw new Error("The key could not be issued. Try again.");

      const data = (await response.json()) as { license: License };
      setState((current) =>
        current.status === "ready" ? { ...current, license: data.license } : current,
      );
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setClaiming(false);
    }
  };

  const copy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="account-card account-state" aria-live="polite">
        <span className="account-spinner" aria-hidden="true"></span>
        <p>Checking your account…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="account-card account-state" role="alert">
        <p className="account-state-title">Account unavailable</p>
        <p className="account-state-copy">{state.message}</p>
        <button type="button" className="btn btn-ghost" onClick={() => setReloadKey((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }

  if (state.status === "signedOut") {
    return (
      <div className="account-card account-signin">
        <div className="account-lock" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 14v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2>Sign in to claim your key</h2>
        <p>
          Lyrica is still free. One Discord account gets one license key, which keeps automated
          signups from minting them in bulk.
        </p>
        {state.configured ? (
          <>
            <a
              className="btn btn-primary account-signin-btn"
              href={`/auth/discord/signin?returnTo=${encodeURIComponent("/account")}`}
            >
              Sign in with Discord
            </a>
            <p className="account-fineprint">
              Discord handles the sign-in. We only receive your username and avatar, and nothing is
              posted.
            </p>
          </>
        ) : (
          <p className="account-fineprint">
            Discord sign-in is being connected. Check back shortly.
          </p>
        )}
      </div>
    );
  }

  const { viewer, license } = state;
  const displayName = viewer.name || "Discord user";

  return (
    <div className="account-card">
      <div className="account-head">
        <div className="account-person">
          {viewer.avatar?.startsWith("https://cdn.discordapp.com/") ? (
            <img
              className="account-avatar"
              src={viewer.avatar}
              alt=""
              width="44"
              height="44"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-avatar account-avatar-fallback" aria-hidden="true">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="account-kicker">Signed in</p>
            <p className="account-name">{displayName}</p>
          </div>
        </div>
        <span className={`account-badge ${license ? "is-issued" : ""}`}>
          {license ? "License issued" : "No key yet"}
        </span>
      </div>

      <div className="account-divider"></div>

      {license ? (
        <>
          <div className="account-section-head">
            <div>
              <h2>Your license key</h2>
              <p>Keep it private. It is tied to this account and can be activated offline.</p>
            </div>
            <button type="button" className="btn btn-ghost account-copy" onClick={() => void copy(license.key)}>
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>

          <label className="sr-only" htmlFor="lyrica-license-key">
            Your Lyrica license key
          </label>
          <textarea
            id="lyrica-license-key"
            className="account-key"
            value={license.key}
            rows={4}
            readOnly
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
          />

          <dl className="account-facts">
            <div>
              <dt>Licensed to</dt>
              <dd>{license.recipient}</dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{dateFormat.format(new Date(license.issuedAt))}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{license.expiresAt ? dateFormat.format(new Date(license.expiresAt)) : "No expiry"}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>Full · free</dd>
            </div>
          </dl>

          <div className="account-steps">
            <p className="account-steps-title">Activate it in the app</p>
            <ol>
              <li>Open Lyrica and right-click its tray icon.</li>
              <li>Choose <strong>License…</strong>, paste the key and select <strong>Activate</strong>.</li>
              <li>The key is checked offline and stored in Windows Credential Manager.</li>
            </ol>
          </div>
        </>
      ) : (
        <div className="account-claim">
          <h2>Claim your free key</h2>
          <p>
            Your account can hold one Lyrica license. It removes the 14-day trial limit and works
            without a connection.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void claim()} disabled={claiming}>
            {claiming ? "Issuing key…" : "Claim free license"}
          </button>
          {claimError && (
            <p className="account-error" role="alert">
              {claimError}
            </p>
          )}
          <p className="account-fineprint">One key per account. There is no payment step.</p>
        </div>
      )}

      <div className="account-footer">
        <p>Signed in with Discord. The app keeps working without an account; this page only stores your key.</p>
        <form method="post" action="/auth/discord/signout">
          <input type="hidden" name="returnTo" value="/" />
          <button type="submit" className="account-signout">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
