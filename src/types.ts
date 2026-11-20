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
  spotifyClientId: string;
  spotifyRedirectPort: number;
  spotifyControls: boolean;
  spotifyAccount: string;
  spotifyProduct: string;
  spotifyExpiresAtMs: number;
  qolEnabled: boolean;
  qolSongMemory: boolean;
  qolSmartHide: boolean;
  qolHidePausedSeconds: number;
  qolNoLyricsPill: boolean;
  qolInstrumentalDots: boolean;
  qolHideOnRepeat: boolean;
  qolRules: QolRule[];
  qolLightMode: string;
  qolThemeFollow: boolean;
  qolSleepMinutes: number;
  qolAllowlist: string[];
  qolDenylist: string[];
  window: WindowState;
}

export interface QolRule {
  id: string;
  enabled: boolean;
  condition: string;
  value: string;
  action: string;
}

/** What the rules and the renderer think is going on right now. */
export interface QolState {
  enabled: boolean;
  lightMode: boolean;
  lightOverride: boolean | null;
  hideOverlays: boolean;
  dimAmbient: boolean;
  process: string;
  fullscreen: boolean;
  onBattery: boolean;
  batterySaver: boolean;
  videoCall: boolean;
  screenShare: boolean;
  notice: string | null;
  sleepUntilMs: number;
  sleepFading: boolean;
  afterPlaylist: boolean;
  repeated: number;
  activeActions: string[];
  memorySize: number;
  windowsLight: boolean;
}

export interface SpotifyStatus {
  linked: boolean;
  clientId: string;
  clientIdSet: boolean;
  redirectUri: string;
  account: string | null;
  product: string | null;
  premium: boolean;
  controls: boolean;
  error: string | null;
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
  qol: QolState;
  lateNight: boolean;
  tapSync: { active: boolean; recorded: number; total: number } | null;
}
