import { useEffect, useState } from 'react';
import { activateLicense, deactivateLicense, licenseStatus } from '../lib/api';
import type { LicenseStatus } from '../types';

export function LicenseDialog() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void licenseStatus()
      .then(setStatus)
      .catch((reason) => setError(String(reason)));
  }, []);

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await activateLicense(key.trim()));
      setKey('');
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await deactivateLicense());
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="license">
      <header className="license-head">
        <h1>Lyrica license</h1>
        {status && <span className={`license-badge ${status.state}`}>{stateLabel(status)}</span>}
      </header>

      <p className="license-message">
        {status?.message ?? 'Checking this PC…'}
        {status?.name && ` · ${status.name}`}
      </p>

      <label className="field field-wide">
        <span>License key</span>
        <textarea
          value={key}
          rows={3}
          placeholder="LYRICA1.…"
          spellCheck={false}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>

      <div className="panel-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || key.trim().length < 20}
          onClick={() => void activate()}
        >
          Activate
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void deactivate()}>
          Deactivate this PC
        </button>
      </div>

      {error && <p className="license-error">{error}</p>}

      <p className="note">
        Keys are signed and checked offline against a public key built into the app. Your key lives
        in Windows Credential Manager, not in the settings file, and is never sent anywhere.
      </p>
      {status && !status.enabled && (
        <p className="note">Licensing is switched off in this build.</p>
      )}
    </div>
  );
}

function stateLabel(status: LicenseStatus): string {
  switch (status.state) {
    case 'active':
      return 'Active';
    case 'trial':
      return status.trialDaysLeft ? `Trial · ${status.trialDaysLeft}d` : 'Trial';
    case 'expired':
      return 'Expired';
    case 'invalid':
      return 'Invalid key';
    case 'disabled':
      return 'Off';
    default:
      return status.state;
  }
}
