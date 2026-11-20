import { contrastWarnings, resolvePalette } from '../lib/colors';
import { getStyle } from '@lyrica/styles';
import type { Settings, Snapshot } from '../types';

const FONTS = [
  'Segoe UI Variable',
  'Bahnschrift',
  'Inter',
  'Rubik',
  'Georgia',
  'Cambria',
  'Impact',
];

interface SettingsDrawerProps {
  snapshot: Snapshot;
  onCommit: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsDrawer({ snapshot, onCommit, onClose }: SettingsDrawerProps) {
  const settings = snapshot.settings;
  const base = getStyle(settings.style).palette;
  const palette = resolvePalette(base, settings);
  const warnings = settings.colorAutoSync ? [] : contrastWarnings(palette);

  return (
    <aside className="mw-drawer">
      <header className="drawer-head">
        <strong>Settings</strong>
        <button type="button" className="ghost-icon" onClick={onClose} title="Close settings">
          ×
        </button>
      </header>

      <section>
        <h3>Size</h3>
        <label className="field">
          <span>Text size</span>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={Math.round(settings.fontScale * 100)}
            onChange={(event) => onCommit({ fontScale: Number(event.target.value) / 100 })}
          />
          <output>{Math.round(settings.fontScale * 100)}%</output>
        </label>
        <button type="button" className="ghost" onClick={() => onCommit({ fontScale: 1 })}>
          Reset size
        </button>
      </section>

      <section>
        <h3>Font</h3>
        <label className="field field-wide">
          <span>Family</span>
          <select
            value={settings.fontFamily}
            onChange={(event) => onCommit({ fontFamily: event.target.value })}
          >
            {FONTS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Weight</span>
          <select
            value={settings.fontWeight}
            onChange={(event) => onCommit({ fontWeight: Number(event.target.value) })}
          >
            <option value={400}>Regular</option>
            <option value={600}>Semi-bold</option>
            <option value={800}>Heavy</option>
          </select>
        </label>
      </section>

      <section>
        <h3>Ambient screen</h3>
        <div className="toggle-row">
          <div>
            <span>Show lyrics while the PC is active</span>
            <small>Off means lyrics only appear on the ambient screen</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.showOnDesktop}
              onChange={(event) => onCommit({ showOnDesktop: event.target.checked })}
            />
            <i />
          </label>
        </div>
        <div className="toggle-row">
          <span>Keep the screen awake while music plays</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.keepAwake}
              onChange={(event) => onCommit({ keepAwake: event.target.checked })}
            />
            <i />
          </label>
        </div>
      </section>

      <section>
        <h3>Aesthetics</h3>
        <div className="toggle-row">
          <div>
            <span>Match the album cover</span>
            <small>Auto Sync derives lyric, highlight and secondary colours</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.colorAutoSync}
              onChange={(event) => onCommit({ colorAutoSync: event.target.checked })}
            />
            <i />
          </label>
        </div>

        <label className="field">
          <span>Lyric text</span>
          <input
            type="color"
            value={settings.colorText}
            disabled={settings.colorAutoSync}
            onChange={(event) => onCommit({ colorText: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Highlight</span>
          <input
            type="color"
            value={settings.colorHighlight}
            disabled={settings.colorAutoSync}
            onChange={(event) => onCommit({ colorHighlight: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Secondary text</span>
          <input
            type="color"
            value={settings.colorSecondary}
            disabled={settings.colorAutoSync}
            onChange={(event) => onCommit({ colorSecondary: event.target.value })}
          />
        </label>

        <button
          type="button"
          className="ghost"
          onClick={() =>
            onCommit({
              colorAutoSync: true,
              colorText: '#F5F7FF',
              colorHighlight: '#FF5C7A',
              colorSecondary: '#9AA3B2',
            })
          }
        >
          Reset colors
        </button>

        {warnings.map((warning) => (
          <p key={warning.label} className="contrast-warning">
            {warning.label} is hard to read ({warning.ratio.toFixed(1)}:1, AA needs 4.5:1)
          </p>
        ))}

        <p className="note">
          Native Design styles keep their own colours. Album-art palettes appear here once artwork is
          available.
        </p>
      </section>
    </aside>
  );
}
