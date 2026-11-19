import type { Snapshot } from '../types';
import { getStyle } from '../styles/registry';
import { StyleCanvas } from '../components/StyleCanvas';

interface AmbientWindowProps {
  snapshot: Snapshot;
}

/** Full-bleed, click-through lyric layer for the chosen monitor. */
export function AmbientWindow({ snapshot }: AmbientWindowProps) {
  const style = getStyle(snapshot.settings.style);

  return (
    <div className="ambient-frame">
      <StyleCanvas snapshot={snapshot} style={style} className="style-canvas" />
      {!snapshot.playback.title && (
        <div className="ambient-idle">
          <span>Lyrica</span>
          <p>Nothing playing</p>
        </div>
      )}
      <div className="ambient-signature">
        {snapshot.playback.title ? `${snapshot.playback.title} — ${snapshot.playback.artist}` : ''}
        <em>{style.name}</em>
      </div>
    </div>
  );
}
