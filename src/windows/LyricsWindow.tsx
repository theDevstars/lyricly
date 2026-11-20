import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { Snapshot } from '../types';
import { getStyle, STYLES } from '../styles/registry';
import { StyleCanvas } from '../components/StyleCanvas';
import { Preferences } from './Preferences';
import { nudge, setStyle, togglePlayPause } from '../lib/api';

interface LyricsWindowProps {
  snapshot: Snapshot;
}

const PLAYERS = ['Spotify', 'Apple Music'];

export function LyricsWindow({ snapshot }: LyricsWindowProps) {
  const style = getStyle(snapshot.settings.style);
  const [hovered, setHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playing = snapshot.playback.status === 'playing';
  const hasTrack = Boolean(snapshot.playback.title);

  useEffect(() => {
    const header = document.querySelector('.topbar');
    if (header) header.setAttribute('data-tauri-drag-region', '');
  }, []);

  // The tray's Preferences item asks this window to reveal the panel.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen('lyrica:open-settings', () => setSettingsOpen(true)).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const close = () => {
    void getCurrentWindow().hide();
  };

  return (
    <div
      className={`lyrics-frame ${hovered ? 'hovered' : ''}`}
      style={{ ['--panel-opacity' as string]: snapshot.settings.opacity }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="topbar" data-tauri-drag-region>
        <div className="players">
          {PLAYERS.map((player) => {
            const active = snapshot.playback.app.toLowerCase().includes(player.split(' ')[0].toLowerCase());
            return (
              <span
                key={player}
                className={`player-dot ${active ? 'on' : ''}`}
                title={active ? `${player} is playing` : `${player} idle`}
              >
                <i />
                {player === 'Spotify' ? 'Spotify' : 'Music'}
              </span>
            );
          })}
        </div>

        <div className="track-line">
          {hasTrack ? (
            <>
              <strong>{snapshot.playback.title}</strong>
              <span>{snapshot.playback.artist}</span>
            </>
          ) : (
            <span>Nothing playing</span>
          )}
        </div>

        <div className="controls" data-tauri-drag-region>
          <div className="nudge" title="Lyric sync offset">
            <button type="button" onClick={() => void nudge(-100)} aria-label="Lyrics earlier">
              −
            </button>
            <span>{(snapshot.settings.nudgeMs / 1000).toFixed(1)}s</span>
            <button type="button" onClick={() => void nudge(100)} aria-label="Lyrics later">
              +
            </button>
          </div>

          <select
            className="style-picker"
            value={snapshot.settings.style}
            onChange={(event) => void setStyle(event.target.value)}
            title="Lyric style"
          >
            {STYLES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`play-pill ${playing ? 'playing' : ''}`}
            onClick={() => void togglePlayPause()}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? '❚❚' : '▶'}
          </button>

          <button
            type="button"
            className={`ghost-icon ${settingsOpen ? 'on' : ''}`}
            onClick={() => setSettingsOpen((open) => !open)}
            title="Settings"
          >
            ⚙
          </button>
          <button type="button" className="ghost-icon" onClick={close} title="Hide">
            ✕
          </button>
        </div>
      </div>

      <div className="stage">
        <StyleCanvas snapshot={snapshot} style={style} className="style-canvas" />
        {!hasTrack && (
          <div className="empty-hint">
            <p>Play a track in Spotify or Apple Music</p>
            <span>Lyrics appear here, word by word.</span>
          </div>
        )}
        {snapshot.loading && hasTrack && <div className="loading-hint">looking up lyrics…</div>}
        {snapshot.error && hasTrack && !snapshot.loading && (
          <div className="error-hint">{snapshot.error}</div>
        )}
        {snapshot.tapSync?.active && (
          <div className="tap-badge">
            tap · {snapshot.tapSync.recorded}/{snapshot.tapSync.total}
          </div>
        )}
        {snapshot.lyrics && (
          <div className="lyric-credit">
            {snapshot.lyrics.attribution ?? `Lyrics from ${snapshot.lyrics.source}`}
            {snapshot.lyrics.timing === 'estimated' && <em> · estimated timing</em>}
          </div>
        )}
      </div>

      {settingsOpen && (
        <div className="settings-overlay">
          <Preferences snapshot={snapshot} onClose={() => setSettingsOpen(false)} />
        </div>
      )}
    </div>
  );
}
