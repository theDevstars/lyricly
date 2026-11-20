import { useEffect, useMemo, useState } from 'react';
import type { CiderStatus, Settings, Snapshot } from '../types';
import { GROUPS, getStyle, STYLES, stylesIn } from '../styles/registry';
import { StylePreview } from '../components/StylePreview';
import {
  quitApp,
  reloadLyrics,
  setAmbientMode,
  setCiderToken,
  setStyle,
  testCider,
  testLyricsSource,
  updateSettings,
} from '../lib/api';

interface PreferencesProps {
  snapshot: Snapshot;
  /// Provided when the panel is shown inside the lyrics window.
  onClose?: () => void;
}

type Tab = 'styles' | 'sources' | 'players' | 'overlay' | 'ambient';

const SOURCES = [
  { id: 'cider', name: 'Cider / Apple Music', hint: 'Apple Music lyrics, word-synced when available' },
  { id: 'local', name: 'Local cache & files', hint: 'Cached results and your own .lrc / .txt edits' },
  { id: 'lrclib', name: 'LRCLIB', hint: 'Free and keyless' },
  { id: 'musixmatch', name: 'Musixmatch', hint: 'Official API; needs your key' },
  { id: 'genius', name: 'Genius', hint: 'Needs a token; page reading is opt-in' },
] as const;

export function Preferences({ snapshot, onClose }: PreferencesProps) {
  const [tab, setTab] = useState<Tab>('styles');
  const [draft, setDraft] = useState<Settings>(snapshot.settings);
  const [hovered, setHovered] = useState<string | null>(null);
  const [ciderToken, setCiderTokenDraft] = useState('');
  const [ciderStatus, setCiderStatus] = useState<CiderStatus | null>(null);
  const [testingCider, setTestingCider] = useState(false);
  const [sourceResults, setSourceResults] = useState<Record<string, string>>({});
  // Held locally and saved on blur, so a settings round trip cannot fight typing.
  const [hostDraft, setHostDraft] = useState(snapshot.settings.ciderHost);
  const [portDraft, setPortDraft] = useState(String(snapshot.settings.ciderPort));

  useEffect(() => {
    setDraft(snapshot.settings);
  }, [snapshot.settings]);

  const commit = (patch: Partial<Settings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void updateSettings(next);
  };

  const monitors = useMemo(() => [0, 1, 2, 3], []);

  const saveCiderToken = async () => {
    await setCiderToken(ciderToken);
    setCiderTokenDraft('');
    setCiderStatus(null);
  };

  const clearCiderToken = async () => {
    await setCiderToken('');
    setCiderTokenDraft('');
    setCiderStatus(null);
  };

  const sourceOrder = useMemo(() => {
    const known = draft.lyricsProviderOrder ?? [];
    const ordered = known.filter((id) => SOURCES.some((source) => source.id === id));
    for (const source of SOURCES) {
      if (!ordered.includes(source.id)) ordered.push(source.id);
    }
    return ordered;
  }, [draft.lyricsProviderOrder]);

  const moveSource = (id: string, delta: number) => {
    const next = [...sourceOrder];
    const index = next.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit({ lyricsProviderOrder: next });
  };

  const toggleSource = (id: string) => {
    const enabled = draft.lyricsProvidersEnabled ?? [];
    const next = enabled.includes(id)
      ? enabled.filter((entry) => entry !== id)
      : [...enabled, id];
    commit({ lyricsProvidersEnabled: next });
  };

  const runSourceTest = async (id: string) => {
    setSourceResults((current) => ({ ...current, [id]: 'Testing…' }));
    try {
      const result = await testLyricsSource(id);
      setSourceResults((current) => ({ ...current, [id]: result }));
    } catch (error) {
      setSourceResults((current) => ({ ...current, [id]: String(error) }));
    }
  };

  const commitCiderHost = () => {
    const host = hostDraft.trim() || 'localhost';
    setHostDraft(host);
    commit({ ciderHost: host });
  };

  const commitCiderPort = () => {
    const parsed = Number(portDraft);
    const port = Number.isFinite(parsed) ? Math.min(65535, Math.max(1, Math.round(parsed))) : 10767;
    setPortDraft(String(port));
    commit({ ciderPort: port });
  };

  const runCiderTest = async () => {
    setTestingCider(true);
    try {
      setCiderStatus(await testCider());
    } catch (error) {
      setCiderStatus({
        reachable: false,
        api: 'none',
        version: null,
        port: null,
        message: String(error),
      });
    } finally {
      setTestingCider(false);
    }
  };

  return (
    <div className="prefs">
      <header className="prefs-header">
        <div>
          <h1>Lyrica</h1>
          <p>Word-timed lyrics for Spotify and Apple Music.</p>
        </div>
        <div className="prefs-now">
          <span className={`dot ${snapshot.playback.status === 'playing' ? 'live' : ''}`} />
          {snapshot.playback.title ? (
            <div>
              <strong>{snapshot.playback.title}</strong>
              <span>
                {snapshot.playback.artist} · {snapshot.playback.app}
              </span>
            </div>
          ) : (
            <div>
              <strong>Nothing playing</strong>
              <span>Start a track to see lyrics</span>
            </div>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button type="button" className={tab === 'styles' ? 'on' : ''} onClick={() => setTab('styles')}>
          Styles
        </button>
        <button type="button" className={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}>
          Sources
        </button>
        <button type="button" className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>
          Players
        </button>
        <button type="button" className={tab === 'overlay' ? 'on' : ''} onClick={() => setTab('overlay')}>
          Overlay
        </button>
        <button type="button" className={tab === 'ambient' ? 'on' : ''} onClick={() => setTab('ambient')}>
          Ambient
        </button>
        {onClose && (
          <button type="button" className="ghost tabs-close" onClick={onClose}>
            Done
          </button>
        )}
      </nav>

      {tab === 'styles' && (
        <section className="gallery">
          {GROUPS.map((group) => (
            <div key={group.id} className="gallery-group">
              <h2>
                {group.title} <span>{group.blurb}</span>
              </h2>
              <div className="grid">
                {stylesIn(group.id).map((style) => {
                  const selected = snapshot.settings.style === style.id;
                  return (
                    <button
                      type="button"
                      key={style.id}
                      className={`card ${selected ? 'selected' : ''}`}
                      onClick={() => void setStyle(style.id)}
                      onMouseEnter={() => setHovered(style.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div
                        className="thumb"
                        style={{
                          background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
                        }}
                      >
                        {hovered === style.id || selected ? (
                          <StylePreview style={style} />
                        ) : (
                          <span className="thumb-name">{style.name}</span>
                        )}
                      </div>
                      <div className="card-body">
                        <strong>{style.name}</strong>
                        <p>{style.description}</p>
                      </div>
                      {style.usesIcons && <em className="badge">icons</em>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'sources' && (
        <section className="panel">
          <h2>Lyrics sources</h2>
          <p className="note">
            Tried in this order. A result below the confidence threshold falls through to the next
            source, and everything is cached locally only.
          </p>

          <ul className="source-list">
            {sourceOrder.map((id, index) => {
              const meta = SOURCES.find((source) => source.id === id);
              const enabled = (draft.lyricsProvidersEnabled ?? []).includes(id);
              return (
                <li key={id} className={`source-row ${enabled ? '' : 'off'}`}>
                  <div className="source-order">
                    <button
                      type="button"
                      className="ghost-icon"
                      disabled={index === 0}
                      onClick={() => moveSource(id, -1)}
                      title="Higher priority"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ghost-icon"
                      disabled={index === sourceOrder.length - 1}
                      onClick={() => moveSource(id, 1)}
                      title="Lower priority"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="source-text">
                    <strong>{meta?.name ?? id}</strong>
                    <small>{meta?.hint ?? ''}</small>
                    {sourceResults[id] && <em className="source-result">{sourceResults[id]}</em>}
                  </div>
                  <button type="button" className="ghost" onClick={() => void runSourceTest(id)}>
                    Test
                  </button>
                  <label className="switch">
                    <input type="checkbox" checked={enabled} onChange={() => toggleSource(id)} />
                    <i />
                  </label>
                </li>
              );
            })}
          </ul>

          <label className="field">
            <span>Confidence threshold</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(draft.lyricsConfidenceThreshold * 100)}
              onChange={(event) =>
                commit({ lyricsConfidenceThreshold: Number(event.target.value) / 100 })
              }
            />
            <output>{draft.lyricsConfidenceThreshold.toFixed(2)}</output>
          </label>

          <div className="toggle-row">
            <span>Prefer synced lyrics over plain</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lyricsPreferSynced}
                onChange={(event) => commit({ lyricsPreferSynced: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Auto-estimate timing for plain lyrics</span>
              <small>Spreads lines across the track by syllable count and marks them estimated</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lyricsAutoEstimate}
                onChange={(event) => commit({ lyricsAutoEstimate: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Allow Genius page parsing for plain lyrics</span>
              <small>
                Off by default. Reading Genius song pages goes against their terms of service and
                may break at any time.
              </small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lyricsAllowGeniusPageParsing}
                onChange={(event) =>
                  commit({ lyricsAllowGeniusPageParsing: event.target.checked })
                }
              />
              <i />
            </label>
          </div>

          <div className="panel-actions">
            <button type="button" className="ghost danger" onClick={() => void reloadLyrics()}>
              Clear lyrics cache
            </button>
          </div>
        </section>
      )}

      {tab === 'players' && (
        <section className="panel">
          <h2>Cider</h2>
          <p className="note">
            Cider (cider.sh) publishes a media session, so it already plays along as an Apple Music
            client. With its local API on, Lyrica also gets exact position, duration and Apple
            Music's own lyrics.
          </p>

          <div className="toggle-row">
            <div>
              <span>Enable Cider</span>
              <small>Read playback and lyrics from Cider's local API</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.ciderEnabled}
                onChange={(event) => commit({ ciderEnabled: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <label className="field">
            <span>Host</span>
            <input
              type="text"
              value={hostDraft}
              onChange={(event) => setHostDraft(event.target.value)}
              onBlur={commitCiderHost}
            />
          </label>

          <label className="field">
            <span>Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={portDraft}
              onChange={(event) => setPortDraft(event.target.value)}
              onBlur={commitCiderPort}
            />
          </label>

          <label className="field field-wide">
            <span>API token</span>
            <input
              type="password"
              placeholder="stored in the Windows Credential Manager"
              value={ciderToken}
              onChange={(event) => setCiderTokenDraft(event.target.value)}
            />
          </label>

          <p className="note">
            Find the token in Cider under <strong>Settings → Connectivity → Manage External
            Application Access to Cider</strong>. It is kept in the Windows Credential Manager, never
            in the settings file, and is never logged.
          </p>

          <div className="toggle-row">
            <div>
              <span>Prefer Cider API over SMTC</span>
              <small>Use Cider's exact position even when the media session would do</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.ciderPreferApi}
                onChange={(event) => commit({ ciderPreferApi: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="panel-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => void saveCiderToken()}
              disabled={!ciderToken.trim()}
            >
              Save token
            </button>
            <button type="button" className="ghost" onClick={() => void clearCiderToken()}>
              Clear token
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void runCiderTest()}
              disabled={testingCider}
            >
              {testingCider ? 'Testing…' : 'Test connection'}
            </button>
          </div>

          {ciderStatus && (
            <p className="note">
              {ciderStatus.message}
              {ciderStatus.version ? ` · v${ciderStatus.version}` : ''}
            </p>
          )}
        </section>
      )}

      {tab === 'overlay' && (
        <section className="panel">
          <label className="field">
            <span>Window opacity</span>
            <input
              type="range"
              min={30}
              max={100}
              value={Math.round(draft.opacity * 100)}
              onChange={(event) => commit({ opacity: Number(event.target.value) / 100 })}
            />
            <output>{Math.round(draft.opacity * 100)}%</output>
          </label>

          <label className="field">
            <span>Lyric sync offset</span>
            <input
              type="range"
              min={-30}
              max={30}
              value={Math.round(draft.nudgeMs / 100)}
              onChange={(event) => commit({ nudgeMs: Number(event.target.value) * 100 })}
            />
            <output>{(draft.nudgeMs / 1000).toFixed(1)}s</output>
          </label>

          <div className="toggle-row">
            <span>Start with Windows</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.autostart}
                onChange={(event) => commit({ autostart: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="panel-actions">
            <button type="button" className="ghost" onClick={() => void reloadLyrics()}>
              Reload lyrics
            </button>
            <button type="button" className="ghost danger" onClick={() => void quitApp()}>
              Quit Lyrica
            </button>
          </div>

          <p className="note">
            Current style: <strong>{getStyle(snapshot.settings.style).name}</strong>. Lyric data comes
            from LRCLIB and is cached locally; word timings are used when a track has them, otherwise the
            line's real duration is split across its words.
          </p>
        </section>
      )}

      {tab === 'ambient' && (
        <section className="panel">
          <div className="toggle-row">
            <div>
              <span>Ambient mode</span>
              <small>Full-screen, click-through lyrics on one monitor</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={snapshot.ambientOn}
                onChange={(event) => void setAmbientMode(event.target.checked)}
              />
              <i />
            </label>
          </div>

          <label className="field">
            <span>Monitor</span>
            <select
              value={draft.ambientMonitor}
              onChange={(event) => commit({ ambientMonitor: Number(event.target.value) })}
            >
              {monitors.map((index) => (
                <option key={index} value={index}>
                  Display {index + 1}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Appear when idle for</span>
            <input
              type="range"
              min={0}
              max={60}
              value={draft.ambientIdleMinutes}
              onChange={(event) => commit({ ambientIdleMinutes: Number(event.target.value) })}
            />
            <output>{draft.ambientIdleMinutes === 0 ? 'never' : `${draft.ambientIdleMinutes} min`}</output>
          </label>

          <label className="field">
            <span>Global hotkey</span>
            <input
              type="text"
              value={draft.ambientHotkey}
              onChange={(event) => commit({ ambientHotkey: event.target.value })}
            />
          </label>

          <div className="toggle-row">
            <div>
              <span>Wallpaper layer</span>
              <small>Render under the desktop icons instead of above them</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.wallpaperLayer}
                onChange={(event) => commit({ wallpaperLayer: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Step aside in exclusive fullscreen</span>
              <small>Hides over games that take over the display; stays above borderless apps</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.hideOverFullscreen}
                onChange={(event) => commit({ hideOverFullscreen: event.target.checked })}
              />
              <i />
            </label>
          </div>
        </section>
      )}

      <footer className="prefs-footer">
        <span>{STYLES.length} styles</span>
        <span>{snapshot.lyrics ? `${snapshot.lyrics.lines.length} lines · ${snapshot.lyrics.source}` : 'no lyrics loaded'}</span>
      </footer>
    </div>
  );
}
