import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Snapshot } from '../types';
import { getStyle } from '../styles/registry';
import { StyleCanvas } from '../components/StyleCanvas';

/// A display with its own style: the same lyric engine, no controls. The window
/// label carries the monitor index, which is how it finds its style.
export function LyricsLayerWindow({ snapshot }: { snapshot: Snapshot }) {
  const monitor = getCurrentWindow().label.slice('lyrics-layer-'.length);
  const ownStyle = snapshot.settings.displayStyles?.[monitor];
  const style = getStyle(ownStyle ?? snapshot.settings.style);

  useEffect(() => {
    document.body.dataset.window = 'lyrics-layer';
  }, []);

  return (
    <div className="lyrics-layer">
      <StyleCanvas snapshot={snapshot} style={style} className="style-canvas" />
    </div>
  );
}
