import { useEffect, useState } from 'react';
import type { QolRule, Settings, Snapshot } from '../types';
import {
  forgetSong,
  qolTestRule,
  setLightOverride,
  sleepPlaylistEnd,
  sleepTimer,
} from '../lib/api';

interface QolPanelProps {
  snapshot: Snapshot;
  commit: (patch: Partial<Settings>) => void;
}

const CONDITIONS = [
  ['fullscreen', 'A fullscreen game or app is focused'],
  ['app', 'A named app is in front (comma separated)'],
  ['battery', 'The laptop is on battery'],
  ['videoCall', 'A video call is happening'],
  ['screenShare', 'Screen sharing or recording is happening'],
  ['time', 'Between two times of day'],
] as const;

const ACTIONS = [
  ['hideOverlays', 'Hide the lyrics overlay'],
  ['lightMode', 'Use Light mode'],
  ['pauseAmbient', 'Pause the ambient screen'],
  ['streamingMode', 'Switch on Streaming mode'],
  ['warmAmbient', 'Dim and warm the ambient screen'],
] as const;

const NEEDS_VALUE = new Set(['app', 'time']);

/** One rule: a condition, its argument, and what to do about it. */
function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: QolRule;
  onChange: (next: QolRule) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(rule.value);
  const [tested, setTested] = useState<boolean | null>(null);

  useEffect(() => {
    setValue(rule.value);
  }, [rule.value]);

  return (
    <div className="qol-rule">
      <label className="switch">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(event) => onChange({ ...rule, enabled: event.target.checked })}
          aria-label="Rule enabled"
        />
        <i />
      </label>

      <select
        value={rule.condition}
        onChange={(event) => onChange({ ...rule, condition: event.target.value })}
        aria-label="Condition"
      >
        {CONDITIONS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>

      {NEEDS_VALUE.has(rule.condition) && (
        <input
          type="text"
          className="qol-value"
          value={value}
          placeholder={rule.condition === 'time' ? '22:00-07:00' : 'game.exe, chrome'}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => onChange({ ...rule, value: value.trim() })}
          aria-label="Condition value"
        />
      )}

      <select
        value={rule.action}
        onChange={(event) => onChange({ ...rule, action: event.target.value })}
        aria-label="Action"
      >
        {ACTIONS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`ghost qol-test ${tested === true ? 'hit' : ''}`}
        onClick={() => {
          void qolTestRule({ ...rule, value: value.trim() })
            .then(setTested)
            .catch(() => setTested(false));
        }}
        title="Check this rule against the desktop right now"
      >
        {tested === null ? 'Test' : tested ? 'matches' : 'no match'}
      </button>

      <button type="button" className="ghost danger" onClick={onRemove} aria-label="Remove rule">
        ✕
      </button>
    </div>
  );
}

export function QolPanel({ snapshot, commit }: QolPanelProps) {
  const { settings, qol } = snapshot;
  const rules = settings.qolRules ?? [];
  const [allow, setAllow] = useState((settings.qolAllowlist ?? []).join(', '));
  const [deny, setDeny] = useState((settings.qolDenylist ?? []).join(', '));

  useEffect(() => {
    setAllow((settings.qolAllowlist ?? []).join(', '));
    setDeny((settings.qolDenylist ?? []).join(', '));
  }, [settings.qolAllowlist, settings.qolDenylist]);

  const parseList = (text: string) =>
    text
      .split(',')
      .map((entry) => entry.trim().replace(/\.exe$/i, '').toLowerCase())
      .filter(Boolean);

  const updateRule = (id: string, next: QolRule) =>
    commit({ qolRules: rules.map((rule) => (rule.id === id ? next : rule)) });

  const removeRule = (id: string) => commit({ qolRules: rules.filter((rule) => rule.id !== id) });

  const addRule = () =>
    commit({
      qolRules: [
        ...rules,
        {
          id: `rule-${Date.now()}`,
          enabled: true,
          condition: 'fullscreen',
          value: '',
          action: 'hideOverlays',
        },
      ],
    });

  const applyLightMode = (mode: string) => {
    commit({ qolLightMode: mode });
    void setLightOverride(mode === 'on' ? 'on' : mode === 'off' ? 'off' : 'auto');
  };

  const remainingMinutes =
    qol.sleepUntilMs > 0 ? Math.max(0, Math.round((qol.sleepUntilMs - Date.now()) / 60_000)) : 0;

  return (
    <>
      <section className="panel">
        <h2>Quality of life</h2>
        <p className="note">
          Small behaviours that make the overlay get out of the way. Everything here is optional and
          costs one cheap check every two seconds.
        </p>

        <div className="toggle-row">
          <div>
            <span>Enable quality of life</span>
            <small>The master switch for everything on this tab</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolEnabled}
              onChange={(event) => commit({ qolEnabled: event.target.checked })}
            />
            <i />
          </label>
        </div>

        <p className="note qol-env">
          {qol.enabled
            ? [
                qol.process ? `in front: ${qol.process}` : 'nothing in front',
                qol.fullscreen ? 'fullscreen' : null,
                qol.onBattery ? 'on battery' : 'on power',
                qol.batterySaver ? 'battery saver' : null,
                qol.videoCall ? 'call detected' : null,
                qol.screenShare ? 'sharing detected' : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Off'}
        </p>
      </section>

      <section className="panel qol-panel">
        <h2>Per-song memory</h2>
        <p className="note">
          The nudge and the style you set on a song come back the next time it plays. Artist and
          album memories cover songs that have none of their own.
        </p>

        <div className="toggle-row">
          <div>
            <span>Remember songs</span>
            <small>{qol.memorySize} remembered</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolSongMemory}
              onChange={(event) => commit({ qolSongMemory: event.target.checked })}
            />
            <i />
          </label>
        </div>

        <div className="panel-actions">
          <button type="button" className="ghost" onClick={() => void forgetSong()}>
            Forget this song
          </button>
        </div>
      </section>

      <section className="panel qol-panel">
        <h2>Smart hide</h2>

        <div className="toggle-row">
          <div>
            <span>Get out of the way</span>
            <small>Hide the lyrics once playback is paused for a while</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolSmartHide}
              onChange={(event) => commit({ qolSmartHide: event.target.checked })}
            />
            <i />
          </label>
        </div>

        <label className="field qol-narrow">
          <span>Pause delay</span>
          <input
            type="number"
            min={0}
            max={120}
            value={settings.qolHidePausedSeconds}
            onChange={(event) =>
              commit({ qolHidePausedSeconds: Math.max(0, Math.min(120, Number(event.target.value) || 0)) })
            }
          />
          <output>{settings.qolHidePausedSeconds}s</output>
        </label>

        <div className="toggle-row">
          <div>
            <span>“No lyrics” pill</span>
            <small>A quiet note instead of an empty stage</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolNoLyricsPill}
              onChange={(event) => commit({ qolNoLyricsPill: event.target.checked })}
            />
            <i />
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <span>Instrumental dots</span>
            <small>Three slow dots through a long gap between lines</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolInstrumentalDots}
              onChange={(event) => commit({ qolInstrumentalDots: event.target.checked })}
            />
            <i />
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <span>Hide when a song loops</span>
            <small>After the same track restarts, stop drawing it</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolHideOnRepeat}
              onChange={(event) => commit({ qolHideOnRepeat: event.target.checked })}
            />
            <i />
          </label>
        </div>
      </section>

      <section className="panel qol-panel">
        <h2>Performance and theme</h2>

        <div className="field qol-light">
          <span>Light mode</span>
          <div className="segmented" role="group" aria-label="Light mode">
            {[
              ['auto', 'Auto'],
              ['on', 'Always'],
              ['off', 'Never'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={settings.qolLightMode === mode ? 'on' : ''}
                onClick={() => applyLightMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <output>{qol.lightMode ? 'on now' : 'off now'}</output>
        </div>

        <p className="note">
          Auto turns it on with battery saver or after five slow frames. 30 fps, no backdrop blur,
          no bloom. {qol.notice ? `${qol.notice}.` : ''}
        </p>

        <div className="toggle-row">
          <div>
            <span>Follow the Windows theme</span>
            <small>Light or dark app chrome, matching Windows</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.qolThemeFollow}
              onChange={(event) => commit({ qolThemeFollow: event.target.checked })}
            />
            <i />
          </label>
        </div>
      </section>

      <section className="panel qol-panel">
        <h2>Sleep timer</h2>
        <p className="note">
          Fades the ambient screen out and closes it. Playback is never touched.
          {qol.sleepUntilMs > 0 ? ` About ${remainingMinutes} min left.` : ''}
        </p>

        <div className="panel-actions">
          {[30, 60, 90].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`ghost ${settings.qolSleepMinutes === minutes ? 'on' : ''}`}
              onClick={() => {
                commit({ qolSleepMinutes: minutes });
                void sleepTimer(minutes);
              }}
            >
              {minutes} min
            </button>
          ))}
          <button
            type="button"
            className="ghost"
            onClick={() => {
              commit({ qolSleepMinutes: 0 });
              void sleepTimer(0);
            }}
          >
            Off
          </button>
        </div>

        <div className="toggle-row">
          <div>
            <span>When the queue ends</span>
            <small>Close the ambient screen after playback stops</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={qol.afterPlaylist}
              onChange={(event) => void sleepPlaylistEnd(event.target.checked)}
              aria-label="Close the ambient screen when the queue ends"
            />
            <i />
          </label>
        </div>
      </section>

      <section className="panel qol-panel">
        <h2>Rules</h2>
        <p className="note">
          One condition, one action. Rules are checked in order and every matching action applies;
          Test asks the desktop right now.
        </p>

        {rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onChange={(next) => updateRule(rule.id, next)}
            onRemove={() => removeRule(rule.id)}
          />
        ))}

        <div className="panel-actions">
          <button type="button" className="ghost" onClick={addRule}>
            Add rule
          </button>
        </div>
      </section>

      <section className="panel qol-panel">
        <h2>Games and fullscreen apps</h2>
        <p className="note">
          A fullscreen game always wins the screen. List a game here to opt it in and keep the
          overlay, or to send it away even when the window is not fullscreen.
        </p>

        <label className="field field-wide">
          <span>Draw over these</span>
          <input
            type="text"
            value={allow}
            placeholder="game, chrome"
            onChange={(event) => setAllow(event.target.value)}
            onBlur={() => commit({ qolAllowlist: parseList(allow) })}
          />
        </label>

        <label className="field field-wide">
          <span>Never draw over these</span>
          <input
            type="text"
            value={deny}
            placeholder="obs, steam"
            onChange={(event) => setDeny(event.target.value)}
            onBlur={() => commit({ qolDenylist: parseList(deny) })}
          />
        </label>

        <p className="note">
          {qol.fullscreen
            ? `Fullscreen app in front: ${qol.process || 'unknown'}`
            : 'No fullscreen app in front right now.'}
        </p>
      </section>
    </>
  );
}
