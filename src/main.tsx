import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './styles.css';
import type { Snapshot } from './types';
import { getState, onState } from './lib/api';
import { LyricsWindow } from './windows/LyricsWindow';
import { AmbientWindow } from './windows/AmbientWindow';
import { LateNightWindow } from './windows/LateNightWindow';
import { LicenseDialog } from './windows/LicenseDialog';
import { MainWindow } from './window/MainWindow';

const label = getCurrentWindow().label;

function Shell() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);

  React.useEffect(() => {
    let unlisten: (() => void) | undefined;

    void getState().then(setSnapshot);
    void onState((next) => setSnapshot(next)).then((stop) => {
      unlisten = stop;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  React.useEffect(() => {
    document.body.dataset.window = label;
  }, []);

  if (!snapshot) {
    return <div className="boot" />;
  }

  if (label === 'ambient') return <AmbientWindow snapshot={snapshot} />;
  if (label.startsWith('late-night')) return <LateNightWindow snapshot={snapshot} />;
  if (label === 'window') return <MainWindow snapshot={snapshot} />;
  if (label === 'license') return <LicenseDialog />;
  return <LyricsWindow snapshot={snapshot} />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);
