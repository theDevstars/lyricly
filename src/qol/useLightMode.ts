import { useEffect } from 'react';
import type { Snapshot } from '../types';

/**
 * Light mode and the Windows light/dark choice are applied as attributes on the
 * root element, so every window (and the CSS) follows without a context.
 */
export function useLightMode(snapshot: Snapshot): void {
  const light = snapshot.qol.lightMode;
  const windowsLight = snapshot.qol.windowsLight;

  useEffect(() => {
    document.documentElement.dataset.light = light ? 'on' : 'off';
  }, [light]);

  useEffect(() => {
    document.documentElement.dataset.windowsLight = windowsLight ? 'on' : 'off';
  }, [windowsLight]);
}
