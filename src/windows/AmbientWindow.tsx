import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Snapshot } from '../types';
import { getStyle } from '../styles/registry';
import { StyleCanvas } from '../components/StyleCanvas';

interface AmbientWindowProps {
  snapshot: Snapshot;
}

/** Full-bleed, click-through lyric layer for the chosen monitor. */
export function AmbientWindow({ snapshot }: AmbientWindowProps) {
  const style = getStyle(snapshot.settings.style);
  const [fading, setFading] = useState(false);

  // The sleep timer asks for a fade before the window closes.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let timer = 0;
    void listen<number>('lyrica:ambient-sleep', (event) => {
      setFading(true);
      timer = window.setTimeout(() => setFading(false), (event.payload ?? 1400) + 600);
    }).then((unlisten) => {
      stop = unlisten;
    });
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, []);

  return (
    <div
      className={`ambient-frame ${fading ? 'qol-fade' : ''} ${
        snapshot.qol.dimAmbient ? 'qol-warm' : ''
      }`}
    >
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
