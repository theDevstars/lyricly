export type PlaybackStatus = 'playing' | 'paused' | 'stopped' | 'none';

export interface Playback {
  app: string;
  title: string;
  artist: string;
  album: string;
  status: PlaybackStatus;
  positionMs: number;
  durationMs: number;
  sampledAtMs: number;
}

export interface LyricWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface LyricLine {
  startMs: number;
  endMs: number;
  text: string;
  words: LyricWord[];
  exact: boolean;
}

export interface Lyrics {
  source: string;
  lines: LyricLine[];
  attribution?: string;
  sourceUrl?: string;
  timing?: 'wordSynced' | 'lineSynced' | 'estimated' | 'unsynced';
  confidence?: number;
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  monitor: string;
}

export interface LicenseStatus {
  enabled: boolean;
  state: 'active' | 'trial' | 'expired' | 'invalid' | 'disabled' | string;
  name: string | null;
  plan: string | null;
  expiresAtMs: number | null;
  trialDaysLeft: number | null;
  message: string;
}

export interface CiderStatus {
  reachable: boolean;
  api: 'v2' | 'legacyV1' | 'none' | string;
  version: string | null;
  port: number | null;
  message: string;
}

export interface Settings {
  style: string;
  nudgeMs: number;
  opacity: number;
  ambientEnabled: boolean;
  ambientMonitor: number;
  ambientIdleMinutes: number;
  ambientHotkey: string;
  tapSyncHotkey: string;
  streamSafe: boolean;
  streamSafeHotkey: string;
  lateNightHotkey: string;
  lateNightIdleMinutes: number;
  lateNightOnPlay: boolean;
  lateNightMode: 'primary' | 'all' | string;
  lateNightMonitor: number;
  lateNightBackground: 'black' | 'dim' | string;
  lateNightClock: boolean;
  lateNight24h: boolean;
  lateNightClickThrough: boolean;
  lateNightHideFullscreen: boolean;
  lateNightKeepAwake: boolean;
  lateNightResumeAfterUnlock: boolean;
  pinnedStyles: string[];
  showInTaskbar: boolean;
  keepAwake: boolean;
  showOnDesktop: boolean;
  colorAutoSync: boolean;
  colorText: string;
  colorHighlight: string;
  colorSecondary: string;
  fontFamily: string;
  fontScale: number;
  fontWeight: number;
  licensingEnabled: boolean;
  trialStartedMs: number;
  wallpaperLayer: boolean;
  hideOverFullscreen: boolean;
  autostart: boolean;
  lyricsAllowGeniusPageParsing: boolean;
  lyricsProviderOrder: string[];
  lyricsProvidersEnabled: string[];
  lyricsPreferSynced: boolean;
  lyricsConfidenceThreshold: number;
  lyricsAutoEstimate: boolean;
  ciderEnabled: boolean;
  ciderHost: string;
  ciderPort: number;
  ciderPreferApi: boolean;
  window: WindowState;
}

export interface Snapshot {
  playback: Playback;
  settings: Settings;
  lyrics: Lyrics | null;
  trackKey: string;
  loading: boolean;
  ambientOn: boolean;
  error: string | null;
  streamSafe: boolean;
  streamSafeError: string | null;
  lateNight: boolean;
  tapSync: { active: boolean; recorded: number; total: number } | null;
}
