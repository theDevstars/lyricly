import { useEffect, useMemo, useState } from 'react';
import type { CiderStatus, Settings, Snapshot, SpotifyStatus } from '../types';
import { GROUPS, getStyle, STYLES, stylesIn } from '@lyrica/styles';
import { StylePreview } from '../components/StylePreview';
import { QolPanel } from '../qol/QolPanel';
import { EffectsLayer } from '../effects/EffectsLayer';
import {
  quitApp,
  reloadLyrics,
  setAmbientMode,
  setDisplayIndex,
  setDisplayStyle,
  setPageMonitor,
  setStreamWindow,
  setCiderToken,
  spotifyLink,
  spotifyStatus,
  spotifyUnlink,
  onSpotify,
  setStyle,
  tapSyncCancel,
  tapSyncRecord,
  tapSyncSave,
  setLateNight,
  tapSyncStart,
  testCider,
  testLyricsSource,
  updateSettings,
} from '../lib/api';

interface PreferencesProps {
  snapshot: Snapshot;
  /// Provided when the panel is shown inside the lyrics window.
  onClose?: () => void;
}

type Tab = 'styles' | 'sources' | 'players' | 'overlay' | 'ambient' | 'qol';

/// Shown in place of a status before the first request comes back.
const emptySpotify: SpotifyStatus = {
  linked: false,
  clientId: '',
  clientIdSet: false,
  redirectUri: 'http://127.0.0.1:8888/callback',
  account: null,
  product: null,
  premium: false,
  controls: false,
  error: null,
};

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
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [spotifyLinking, setSpotifyLinking] = useState(false);
  const [spotifyClientId, setSpotifyClientIdDraft] = useState(
    snapshot.settings.spotifyClientId ?? '',
  );
  const [testingCider, setTestingCider] = useState(false);
  const [sourceResults, setSourceResults] = useState<Record<string, string>>({});
  const [hotkeyDraft, setHotkeyDraft] = useState(snapshot.settings.tapSyncHotkey);
  const [tapError, setTapError] = useState<string | null>(null);
  const [captureDraft, setCaptureDraft] = useState(snapshot.settings.streamSafeHotkey);
  const [lateHotkeyDraft, setLateHotkeyDraft] = useState(snapshot.settings.lateNightHotkey);
  // Held locally and saved on blur, so a settings round trip cannot fight typing.
  const [hostDraft, setHostDraft] = useState(snapshot.settings.ciderHost);
  const [portDraft, setPortDraft] = useState(String(snapshot.settings.ciderPort));

  useEffect(() => {
    setDraft(snapshot.settings);
  }, [snapshot.settings]);

  // The link finishes on a worker thread, so the status is re-read on its event.
  useEffect(() => {
    void spotifyStatus().then(setSpotify).catch(() => {});
    let unlisten: (() => void) | undefined;
    void onSpotify(() => {
      setSpotifyLinking(false);
      void spotifyStatus().then(setSpotify).catch(() => {});
    }).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, []);

  const connectSpotify = async () => {
    const next = { ...draft, spotifyClientId: spotifyClientId.trim() };
    setDraft(next);
    setSpotifyLinking(true);
    try {
      // Save first: the login thread reads the Client ID from the settings file.
      await updateSettings(next);
      await spotifyLink();
    } catch (error) {
      setSpotifyLinking(false);
      setSpotify((current) =>
        current ? { ...current, error: String(error) } : { ...emptySpotify, error: String(error) },
      );
    }
  };

  const disconnectSpotify = async () => {
    try {
      setSpotify(await spotifyUnlink());
    } catch (error) {
      setSpotify((current) => (current ? { ...current, error: String(error) } : current));
    }
  };

  const commit = (patch: Partial<Settings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void updateSettings(next);
  };

  const styleOption = (key: string): string | undefined => (draft.styleOptions ?? {})[key];

  const commitStyleOption = (key: string, value: string) => {
    commit({ styleOptions: { ...(draft.styleOptions ?? {}), [key]: value } });
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

  const runTapAction = async (action: () => Promise<unknown>) => {
    try {
      setTapError(null);
      await action();
    } catch (error) {
      setTapError(String(error));
    }
  };

  const commitLateHotkey = () => {
    const combo = lateHotkeyDraft.trim() || 'Ctrl+Alt+K';
    setLateHotkeyDraft(combo);
    commit({ lateNightHotkey: combo });
  };

  const commitCaptureHotkey = () => {
    const combo = captureDraft.trim() || 'Ctrl+Alt+S';
    setCaptureDraft(combo);
    commit({ streamSafeHotkey: combo });
  };

  const commitTapHotkey = () => {
    const combo = hotkeyDraft.trim() || 'Ctrl+Alt+T';
    setHotkeyDraft(combo);
    commit({ tapSyncHotkey: combo });
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
        <button type="button" className={tab === 'qol' ? 'on' : ''} onClick={() => setTab('qol')}>
          Quality of life
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

          <h2>Spotify account</h2>
          <p className="note">
            Linking is optional — Windows' own media session already follows Spotify. A linked
            account adds the exact position, the large artwork and, with Premium, tray controls.
            Tokens are kept in the Windows Credential Manager.
          </p>

          <label className="field field-wide">
            <span>Client ID</span>
            <input
              type="text"
              value={spotifyClientId}
              placeholder="from the Spotify developer dashboard"
              onChange={(event) => setSpotifyClientIdDraft(event.target.value)}
              onBlur={() => commit({ spotifyClientId: spotifyClientId.trim() })}
            />
          </label>

          <p className="note">
            Lyrica ships without a Client ID, so nothing is shared until you bring your own. Create
            a free app in the Spotify developer dashboard, add{' '}
            <code>{spotify?.redirectUri ?? 'http://127.0.0.1:8888/callback'}</code> as a redirect
            URI, keep it in Development Mode and add your own account under <em>Users</em>.
          </p>

          <div className="toggle-row">
            <div>
              <span>Allow playback controls</span>
              <small>Requests the extra scope; Spotify only honours it on Premium</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.spotifyControls}
                onChange={(event) => commit({ spotifyControls: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="panel-actions">
            <button
              type="button"
              className="ghost"
              disabled={spotifyLinking || !spotifyClientId.trim()}
              onClick={() => void connectSpotify()}
            >
              {spotifyLinking
                ? 'Waiting for the browser…'
                : spotify?.linked
                  ? 'Link again'
                  : 'Connect Spotify'}
            </button>
            {spotify?.linked && (
              <button type="button" className="ghost danger" onClick={() => void disconnectSpotify()}>
                Disconnect
              </button>
            )}
          </div>

          <p className="note">
            {spotify?.error
              ? spotify.error
              : spotify?.linked
                ? `Linked as ${spotify.account ?? 'your account'}${
                    spotify.product ? ` · ${spotify.product}` : ''
                  }. Disconnecting removes the tokens here; revoke the app itself in your Spotify account page.`
                : 'Not linked. Playback keeps working through the media session.'}
          </p>
        </section>
      )}

      {tab === 'overlay' && (
        <section className="panel">
          <label className="field">
            <span>Show on display</span>
            <select
              value={draft.ambientMonitor}
              onChange={(event) => {
                const index = Number(event.target.value);
                // One setting for the whole app: the overlay, Ambient and Late
                // Night all move to this display.
                commit({ ambientMonitor: index, lateNightMonitor: index });
                void setDisplayIndex(index);
              }}
            >
              {monitors.map((index) => (
                <option key={index} value={index}>
                  Display {index + 1}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>App page on display</span>
            <select
              value={snapshot.settings.pageMonitor ?? 0}
              onChange={(event) => void setPageMonitor(Number(event.target.value))}
            >
              {monitors.map((index) => (
                <option key={index} value={index}>
                  Display {index + 1}
                </option>
              ))}
            </select>
          </label>

          <div className="per-display">
            <p className="note">
              Give a display its own style and Lyrica opens a click-through lyric overlay on it.
              Leave a display on Main style to keep the style above everywhere.
            </p>
            {monitors.map((index) => (
              <label className="field" key={index}>
                <span>Display {index + 1} style</span>
                <select
                  value={snapshot.settings.displayStyles?.[String(index)] ?? ''}
                  onChange={(event) =>
                    void setDisplayStyle(index, event.target.value || null)
                  }
                >
                  <option value="">Main style</option>
                  {STYLES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <EffectsLayer
            snapshot={snapshot}
            onToggle={(id, on) => {
              if (id === 'reduce-motion') {
                commit({ reduceMotion: on });
              } else if (id === 'photosensitive') {
                commit({ photosensitive: on });
              } else {
                const next = { ...(snapshot.settings.styleEffects ?? {}) };
                if (on) next[id] = 'on';
                else delete next[id];
                commit({ styleEffects: next });
              }
            }}
          />

          <label className="field">
            <span>Context Window lines</span>
            <input
              type="range"
              min={3}
              max={7}
              value={Number(styleOption('context-window.contextLines') ?? 5)}
              onChange={(event) =>
                commitStyleOption('context-window.contextLines', event.target.value)
              }
            />
            <output>{Number(styleOption('context-window.contextLines') ?? 5)} lines</output>
          </label>

          <label className="field">
            <span>Dual Screen Split pane</span>
            <select
              value={String(styleOption('dual-screen-split.pane') ?? 'both')}
              onChange={(event) => commitStyleOption('dual-screen-split.pane', event.target.value)}
            >
              <option value="both">Both, side by side</option>
              <option value="main">Big type only</option>
              <option value="wall">Full lyrics only</option>
            </select>
          </label>

          <div className="toggle-row">
            <div>
              <span>Stream window (OBS)</span>
              <small>A clean second window with only the lyric style, for window capture.</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(draft.streamWindow)}
                onChange={(event) => {
                  commit({ streamWindow: event.target.checked });
                  void setStreamWindow(event.target.checked);
                }}
              />
              <i />
            </label>
          </div>

          <label className="field">
            <span>Style randomizer</span>
            <select
              value={draft.randomizerMode ?? 'off'}
              onChange={(event) => commit({ randomizerMode: event.target.value })}
            >
              <option value="off">Off</option>
              <option value="chorus">Every chorus</option>
              <option value="songs">Every few songs</option>
            </select>
          </label>

          {draft.randomizerMode === 'songs' && (
            <label className="field">
              <span>Switch every</span>
              <input
                type="range"
                min={1}
                max={10}
                value={draft.randomizerEverySongs ?? 3}
                onChange={(event) => commit({ randomizerEverySongs: Number(event.target.value) })} />
              <output>{draft.randomizerEverySongs ?? 3} songs</output>
            </label>
          )}

          <div className="toggle-row">
            <div>
              <span>Style by mood</span>
              <small>Pick the style pool from the song's energy.</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(draft.moodMode)}
                onChange={(event) => commit({ moodMode: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Sing-along scoring</span>
              <small>Microphone, scored locally; nothing is recorded or sent.</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(draft.singAlong)}
                onChange={(event) => commit({ singAlong: event.target.checked })}
              />
              <i />
            </label>
          </div>

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

          <div className="tap-sync">
            <div className="tap-sync-head">
              <span>Tap to sync</span>
              <small>
                {snapshot.tapSync?.active
                  ? `${snapshot.tapSync.recorded} of ${snapshot.tapSync.total} lines recorded`
                  : 'Not running'}
              </small>
            </div>
            <label className="field field-wide">
              <span>Hotkey</span>
              <input
                type="text"
                value={hotkeyDraft}
                onChange={(event) => setHotkeyDraft(event.target.value)}
                onBlur={commitTapHotkey}
              />
            </label>
            <p className="note">
              Press the hotkey at the start of each line while the song plays; the last line saves
              automatically. The result is written as an .lrc override for this track and loads the
              next time it plays.
            </p>
            <div className="panel-actions">
              {snapshot.tapSync?.active ? (
                <>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void runTapAction(() => tapSyncRecord())}
                  >
                    Record line
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void runTapAction(() => tapSyncSave())}
                  >
                    Save .lrc
                  </button>
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => void tapSyncCancel()}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void runTapAction(() => tapSyncStart())}
                >
                  Start tap sync
                </button>
              )}
            </div>
            {tapError && <p className="note">{tapError}</p>}
          </div>

          <div className="tap-sync">
            <div className="tap-sync-head">
              <span>Hide from screen capture</span>
              <small>
                {snapshot.streamSafe ? 'On — invisible to recorders' : 'Off'}
              </small>
            </div>
            <label className="field field-wide">
              <span>Hotkey</span>
              <input
                type="text"
                value={captureDraft}
                onChange={(event) => setCaptureDraft(event.target.value)}
                onBlur={commitCaptureHotkey}
              />
            </label>
            <p className="note">
              Keeps the lyrics out of OBS, Discord, Teams and screen recordings while staying
              visible on your monitor. Needs Windows 10 2004 or newer.
            </p>
            <div className="panel-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => commit({ streamSafe: !snapshot.settings.streamSafe })}
              >
                {snapshot.settings.streamSafe ? 'Stop hiding' : 'Hide from capture'}
              </button>
            </div>
            {snapshot.streamSafeError && <p className="note">{snapshot.streamSafeError}</p>}
          </div>

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
                checked={draft.ambientEnabled}
                onChange={(event) => {
                  // Persisted master switch: also decides whether the idle timer
                  // may bring the ambient screen back by itself.
                  commit({ ambientEnabled: event.target.checked });
                  void setAmbientMode(event.target.checked);
                }}
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

          <div className="toggle-row">
            <div>
              <span>Open on its own</span>
              <small>
                Let the idle timer below show Ambient. Off means only the hotkey or the toggle opens
                it.
              </small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.ambientAutoOpen}
                onChange={(event) => commit({ ambientAutoOpen: event.target.checked })}
              />
              <i />
            </label>
          </div>

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
          <h2>Rim Light</h2>
          <p className="note">
            Two colours bleeding off the edge of the ambient display, taken from the active style
            or picked here. The ring sits inside the monitor edge, so nothing is pushed off-screen.
          </p>

          <div className="toggle-row">
            <div>
              <span>Rim Light</span>
              <small>Ambient screen only; the floating overlay keeps its own shape</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.rimLightEnabled}
                onChange={(event) => commit({ rimLightEnabled: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <label className="field">
            <span>Thickness</span>
            <input
              type="range"
              min={2}
              max={24}
              value={draft.rimLightThickness}
              onChange={(event) => commit({ rimLightThickness: Number(event.target.value) })}
            />
            <output>{draft.rimLightThickness}px</output>
          </label>

          <label className="field">
            <span>Glow</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(draft.rimLightGlow * 100)}
              onChange={(event) => commit({ rimLightGlow: Number(event.target.value) / 100 })}
            />
            <output>{Math.round(draft.rimLightGlow * 100)}%</output>
          </label>

          <label className="field">
            <span>Motion</span>
            <select
              value={draft.rimLightAnimation}
              onChange={(event) => commit({ rimLightAnimation: event.target.value })}
            >
              <option value="breathe">Breathe with the song</option>
              <option value="drift">Drift slowly</option>
              <option value="still">Hold still</option>
            </select>
          </label>

          <label className="field">
            <span>Colours</span>
            <select
              value={draft.rimLightColors}
              onChange={(event) => commit({ rimLightColors: event.target.value })}
            >
              <option value="style">From the active style</option>
              <option value="custom">Pick two</option>
            </select>
          </label>

          {draft.rimLightColors === 'custom' && (
            <label className="field field-wide">
              <span>Two colours</span>
              <div className="rim-colors">
                <input
                  type="color"
                  value={draft.rimLightColorA}
                  onChange={(event) => commit({ rimLightColorA: event.target.value })}
                  aria-label="Rim Light colour one"
                />
                <input
                  type="color"
                  value={draft.rimLightColorB}
                  onChange={(event) => commit({ rimLightColorB: event.target.value })}
                  aria-label="Rim Light colour two"
                />
              </div>
            </label>
          )}

          <h2>Late Night</h2>
          <p className="note">
            A full-screen, lock-screen-styled takeover for the idle evening. Windows does not let
            apps draw on the real lock screen, so this dims the desktop instead.
          </p>

          <div className="panel-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => void setLateNight(!snapshot.lateNight)}
            >
              {snapshot.lateNight ? 'Exit Late Night' : 'Enter Late Night'}
            </button>
          </div>

          <label className="field">
            <span>Global hotkey</span>
            <input
              type="text"
              value={lateHotkeyDraft}
              onChange={(event) => setLateHotkeyDraft(event.target.value)}
              onBlur={commitLateHotkey}
            />
          </label>

          <label className="field">
            <span>Monitors</span>
            <select
              value={draft.lateNightMode}
              onChange={(event) =>
                commit({ lateNightMode: event.target.value as 'primary' | 'all' })
              }
            >
              <option value="primary">Primary only</option>
              <option value="all">All monitors (mirror)</option>
            </select>
          </label>

          <label className="field">
            <span>Background</span>
            <select
              value={draft.lateNightBackground}
              onChange={(event) =>
                commit({ lateNightBackground: event.target.value as 'black' | 'dim' })
              }
            >
              <option value="black">Black</option>
              <option value="dim">Dimmed desktop</option>
            </select>
          </label>

          <label className="field">
            <span>Appear when idle for</span>
            <input
              type="range"
              min={0}
              max={60}
              value={draft.lateNightIdleMinutes}
              onChange={(event) =>
                commit({ lateNightIdleMinutes: Number(event.target.value) })
              }
            />
            <output>
              {draft.lateNightIdleMinutes === 0 ? 'never' : `${draft.lateNightIdleMinutes} min`}
            </output>
          </label>

          <div className="toggle-row">
            <div>
              <span>Clock and date</span>
              <small>Large lock-screen style time, centred near the top</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lateNightClock}
                onChange={(event) => commit({ lateNightClock: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <span>24-hour clock</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lateNight24h}
                onChange={(event) => commit({ lateNight24h: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Click-through</span>
              <small>Mouse input passes to the desktop below; use the hotkey to exit</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lateNightClickThrough}
                onChange={(event) => commit({ lateNightClickThrough: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Open when playback starts</span>
              <small>Enter the screen as soon as something begins playing</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lateNightOnPlay}
                onChange={(event) => commit({ lateNightOnPlay: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Step aside in exclusive fullscreen</span>
              <small>Closes over games and fullscreen video</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lateNightHideFullscreen}
                onChange={(event) => commit({ lateNightHideFullscreen: event.target.checked })}
              />
              <i />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <span>Resume after unlocking</span>
              <small>Reopens if Windows locked while the screen was up</small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.lateNightResumeAfterUnlock}
                onChange={(event) => commit({ lateNightResumeAfterUnlock: event.target.checked })}
              />
              <i />
            </label>
          </div>
        </section>
      )}

      {tab === 'qol' && <QolPanel snapshot={snapshot} commit={commit} />}

      <footer className="prefs-footer">
        <span>{STYLES.length} styles</span>
        <span>{snapshot.lyrics ? `${snapshot.lyrics.lines.length} lines · ${snapshot.lyrics.source}` : 'no lyrics loaded'}</span>
      </footer>
    </div>
  );
}
