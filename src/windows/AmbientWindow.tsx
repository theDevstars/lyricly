import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Snapshot } from '../types';
import { getStyle } from '@lyrica/styles';
import { StyleCanvas } from '../components/StyleCanvas';

interface AmbientWindowProps {
  snapshot: Snapshot;
}

/** A short fade before the ambient window closes (sleep timer). */
const SLEEP_FADE_MS = 1400;

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
      timer = window.setTimeout(() => setFading(false), (event.payload ?? SLEEP_FADE_MS) + 600);
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
      }`      }
    >
      {/* The styles draw their own "play something" line, which would sit under
          our idle text; with no track there is nothing for the canvas to show. */}
      {snapshot.playback.title && (
        <StyleCanvas snapshot={snapshot} style={style} className="style-canvas" />
      )}
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
