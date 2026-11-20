import { useEffect } from 'react';
import { StyleCanvas } from '../components/StyleCanvas';
import { getStyle } from '../styles/registry';
import type { Snapshot } from '../types';

/**
 * The OBS window: one style, edge to edge, no chrome. Point a window or game
 * capture at it and the stream gets the same lyrics the desktop does.
 */
export function StreamWindow({ snapshot }: { snapshot: Snapshot }) {
  const style = getStyle(snapshot.settings.style);

  useEffect(() => {
    document.body.dataset.window = 'stream';
  }, []);

  return (
    <div className="stream-frame">
      <StyleCanvas snapshot={snapshot} style={style} className="style-canvas" />
    </div>
  );
}
