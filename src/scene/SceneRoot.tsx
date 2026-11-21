import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getStyle } from '@lyrica/styles';
import { StyleCanvas } from '../components/StyleCanvas';
import { resolvePalette } from '../lib/colors';
import { sceneLayerFor } from '../lib/sceneBlend';
import type { Snapshot } from '../types';

interface SceneRootProps {
  snapshot: Snapshot;
}

/**
 * The desktop scene: a procedural dark backdrop with widgets on top, hosted in
 * Explorer's wallpaper layer so the icons and desktop stay in front.
 *
 * Everything here is display-only on purpose — a wallpaper child never receives
 * clicks, so the scene proves the layer and the widgets come later.
 */
export function SceneRoot({ snapshot }: SceneRootProps) {
  const label = getCurrentWindow().label;
  const style = getStyle(snapshot.settings.style);
  const palette = resolvePalette(style.palette, snapshot.settings);
  // Dark stages screen away so their black drops out; light paper stages float
  // as an inset page so the ink stays readable. The planet survives both ways.
  const layer = sceneLayerFor(palette.background);
  const layerStyle: CSSProperties =
    layer.inset > 0
      ? {
          mixBlendMode: layer.blend,
          inset: `${layer.inset * 100}%`,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
        }
      : { mixBlendMode: layer.blend };
  const [fps, setFps] = useState(0);
  const [seen, setSeen] = useState(0);
  const [visibility, setVisibility] = useState(document.visibilityState);
  const frames = useRef(0);

  // Read the display from the webview itself: a host event would race the first
  // paint, and the scene window is already sized to one monitor.
  const target = `${window.screen.width}×${window.screen.height} @ ${Math.round(
    window.devicePixelRatio * 100,
  )}%`;

  // Frame counter: the point of this widget is to prove the layer is live, not
  // a still frame left behind by the compositor.
  useEffect(() => {
    let raf = 0;
    const started = performance.now();
    const tick = () => {
      frames.current += 1;
      const elapsed = performance.now() - started;
      if (elapsed > 1000) {
        setFps(Math.round((frames.current * 1000) / elapsed));
        frames.current = 0;
        setSeen((value) => value + 1);
        setVisibility(document.visibilityState);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const now = new Date();
  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="scene-root">
      <div className="scene-planet" aria-hidden="true" />
      {/* The style paints its own black stage; screen blending keeps the planet
          behind it while the bubbles and type sit on top. */}
      {snapshot.playback.title && (
        <div className="scene-canvas" style={layerStyle}>
          <StyleCanvas snapshot={snapshot} style={style} className="style-canvas" />
        </div>
      )}
      <div className="scene-test-widget">
        <header>
          <span className="scene-eyebrow">Scene host · {label}</span>
          <time>{clock}</time>
        </header>
        <h1>Behind the icons</h1>
        <p>
          Window parented to Explorer&apos;s WorkerW layer. If you can see the desktop icons on top
          of this card, the wallpaper host works.
        </p>
        <dl>
          <div>
            <dt>Display</dt>
            <dd>{target}</dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd>
              {fps} fps · {seen}s · {visibility}
            </dd>
          </div>
          <div>
            <dt>Style</dt>
            <dd>{snapshot.settings.style}</dd>
          </div>
        </dl>
        <div className="scene-ring" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
