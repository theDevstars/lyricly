import { useEffect, useState } from 'react';
import { nudge, pinStyle, setStyle, updateSettings } from '../lib/api';
import { getStyle, STYLES } from '@lyrica/styles';
import { DEMO_DURATION_MS } from '../demo/demoTrack';
import { useDemoPlayer } from '../demo/useDemoPlayer';
import type { Snapshot } from '../types';
import { PreviewStage } from './PreviewStage';
import { SettingsDrawer } from './SettingsDrawer';
import { StyleTiles } from './StyleTiles';

const PLAYERS = [
  { id: 'spotify', label: 'Spotify' },
  { id: 'apple', label: 'Apple Music' },
  { id: 'cider', label: 'Cider' },
];

/** The main window: preview, pick and configure styles. */
export function MainWindow({ snapshot }: { snapshot: Snapshot }) {
  const [previewId, setPreviewId] = useState(snapshot.settings.style);
  const [source, setSource] = useState<'demo' | 'now'>('demo');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const demo = useDemoPlayer(source === 'demo');

  const style = getStyle(previewId);
  const pinned = snapshot.settings.pinnedStyles ?? [];
  const active = snapshot.settings.style;

  const step = (delta: number) =>
    setPreviewId((current) => {
      const index = STYLES.findIndex((entry) => entry.id === current);
      return STYLES[(index + delta + STYLES.length) % STYLES.length].id;
    });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commit = (patch: Partial<Snapshot['settings']>) =>
    void updateSettings({ ...snapshot.settings, ...patch });

  return (
    <div className="main-window">
      <header className="mw-top">
        <div className="mw-brand">
          Lyrica <small>{STYLES.length} styles</small>
        </div>
        <div className="mw-dots">
          {PLAYERS.map((player) => {
            const state = playerState(snapshot, player.id);
            return (
              <span
                key={player.id}
                className={`player-dot ${state}`}
                title={`${player.label} — ${label(state)}`}
              >
                {player.label}
              </span>
            );
          })}
        </div>
        <div className="mw-top-actions">
          <button type="button" className="ghost" onClick={() => void nudge(-100)}>
            −100 ms
          </button>
          <button type="button" className="ghost" onClick={() => void nudge(100)}>
            +100 ms
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            {drawerOpen ? 'Close settings' : 'Settings'}
          </button>
        </div>
      </header>

      <section className="mw-stage">
        <button type="button" className="ghost-icon mw-arrow" onClick={() => step(-1)}>
          ‹
        </button>
        <PreviewStage snapshot={snapshot} style={style} demo={demo} source={source} />
        <button type="button" className="ghost-icon mw-arrow" onClick={() => step(1)}>
          ›
        </button>
      </section>

      <div className="mw-controls">
        <div className="mw-source">
          <button
            type="button"
            className={source === 'demo' ? 'on' : ''}
            onClick={() => setSource('demo')}
          >
            Preview: Demo
          </button>
          <button
            type="button"
            className={source === 'now' ? 'on' : ''}
            onClick={() => setSource('now')}
          >
            Now playing
          </button>
        </div>

        <button type="button" className="ghost" onClick={demo.toggle}>
          {demo.playing ? 'Pause' : 'Play'}
        </button>
        <input
          className="mw-scrub"
          type="range"
          min={0}
          max={DEMO_DURATION_MS}
          value={Math.round(demo.positionMs)}
          onChange={(event) => demo.seek(Number(event.target.value))}
        />
        <span className="mw-time">
          {clock(demo.positionMs)} / {clock(DEMO_DURATION_MS)}
        </span>

        <button
          type="button"
          className="primary"
          disabled={active === style.id}
          onClick={() => void setStyle(style.id)}
        >
          {active === style.id ? 'Selected' : 'Select'}
        </button>
        <button
          type="button"
          className={`ghost ${pinned.includes(style.id) ? 'on' : ''}`}
          onClick={() => void pinStyle(style.id, !pinned.includes(style.id))}
        >
          {pinned.includes(style.id) ? 'Pinned' : 'Pin'}
        </button>
        <span className={`mw-badge ${timingClass(snapshot)}`}>{timingBadge(snapshot)}</span>
      </div>

      <StyleTiles
        activeId={active}
        previewId={style.id}
        pinned={pinned}
        onPick={setPreviewId}
      />

      <footer className="mw-footer">
        <a href="https://discord.gg/" target="_blank" rel="noreferrer">
          Join the community
        </a>
        <a href="https://github.com/theDevstars/lyricly/releases" target="_blank" rel="noreferrer">
          What&apos;s new
        </a>
        <a href="https://github.com/theDevstars/lyricly" target="_blank" rel="noreferrer">
          Source
        </a>
        <span>Word timings stay the same across every style.</span>
      </footer>

      {drawerOpen && (
        <SettingsDrawer
          snapshot={snapshot}
          onCommit={commit}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function playerState(snapshot: Snapshot, id: string): 'ok' | 'waiting' | 'problem' | 'off' {
  const app = snapshot.playback.app.toLowerCase();
  const matches = app.includes(id) || (id === 'apple' && app.includes('music'));
  if (!matches) return 'off';
  if (snapshot.playback.status === 'playing') return 'ok';
  if (snapshot.playback.status === 'paused') return 'waiting';
  return 'problem';
}

function label(state: 'ok' | 'waiting' | 'problem' | 'off'): string {
  return state === 'ok'
    ? 'synced'
    : state === 'waiting'
      ? 'waiting'
      : state === 'problem'
        ? 'problem'
        : 'not connected';
}

function timingBadge(snapshot: Snapshot): string {
  switch (snapshot.lyrics?.timing) {
    case 'wordSynced':
      return 'Word-by-word';
    case 'estimated':
      return 'Estimated';
    case 'lineSynced':
      return 'Line-by-line';
    case 'unsynced':
      return 'No timing';
    default:
      return 'No lyrics';
  }
}

function timingClass(snapshot: Snapshot): string {
  return snapshot.lyrics?.timing ?? 'none';
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}
