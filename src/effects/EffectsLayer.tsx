import type { Snapshot } from '../types';
import { EFFECTS } from '@lyrica/styles';

interface EffectsLayerProps {
  snapshot: Snapshot;
  onToggle: (id: string, on: boolean) => void;
}

/**
 * The Aesthetics panel: one switch per shared effect. Every effect is
 * independent and applies to whichever styles support it.
 */
export function EffectsLayer({ snapshot, onToggle }: EffectsLayerProps) {
  const enabled = snapshot.settings.styleEffects ?? {};
  const reduceMotion = snapshot.settings.reduceMotion;
  const photosensitive = snapshot.settings.photosensitive;

  return (
    <div className="effects-layer">
      <p className="note">
        Shared effects, applied on top of any style that supports them. Flashing effects switch
        themselves off when photosensitivity mode is on.
      </p>
      {EFFECTS.map((effect) => (
        <div className="toggle-row" key={effect.id}>
          <div>
            <span>{effect.name}</span>
            <small>{effect.description}</small>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled[effect.id] === 'on'}
              disabled={effect.flashing && photosensitive}
              onChange={(event) => onToggle(effect.id, event.target.checked)}
            />
            <i />
          </label>
        </div>
      ))}

      <div className="toggle-row">
        <div>
          <span>Reduce Motion</span>
          <small>Static layouts with crossfades only, for every style.</small>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={Boolean(reduceMotion)}
            onChange={(event) => onToggle('reduce-motion', event.target.checked)}
          />
          <i />
        </label>
      </div>

      <div className="toggle-row">
        <div>
          <span>Photosensitivity mode</span>
          <small>No flashing, tearing or strobing above 3 Hz.</small>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={Boolean(photosensitive)}
            onChange={(event) => onToggle('photosensitive', event.target.checked)}
          />
          <i />
        </label>
      </div>
    </div>
  );
}
