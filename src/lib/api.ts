import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  CiderStatus,
  LicenseStatus,
  QolRule,
  QolState,
  Settings,
  Snapshot,
  SpotifyStatus,
} from '../types';

export const getState = (): Promise<Snapshot> => invoke<Snapshot>('get_state');

export const setStyle = (style: string): Promise<void> => invoke('set_style', { style });

export const updateSettings = (patch: Settings): Promise<void> =>
  invoke('update_settings', { patch });

export const nudge = (deltaMs: number): Promise<void> => invoke('nudge', { deltaMs });

export const togglePlayPause = (): Promise<void> => invoke('toggle_play_pause');

export const openWindow = (): Promise<void> => invoke('open_window');

export const pinStyle = (style: string, pinned: boolean): Promise<void> =>
  invoke('pin_style', { style, pinned });

export const licenseStatus = (): Promise<LicenseStatus> => invoke('license_status');

export const activateLicense = (key: string): Promise<LicenseStatus> =>
  invoke('activate_license', { key });

export const deactivateLicense = (): Promise<LicenseStatus> => invoke('deactivate_license');

export const openLicense = (): Promise<void> => invoke('open_license');

export const setLateNight = (enabled: boolean): Promise<void> =>
  invoke('set_late_night', { enabled });

export const setAmbientMode = (enabled: boolean): Promise<void> =>
  invoke('set_ambient_mode', { enabled });

/** The one display setting: overlay, Ambient and Late Night all follow it. */
export const setDisplayIndex = (index: number): Promise<void> =>
  invoke('set_display_index', { index });

export const setWallpaperLayer = (enabled: boolean): Promise<void> =>
  invoke('set_wallpaper_layer', { enabled });

export const reloadLyrics = (): Promise<void> => invoke('reload_lyrics');

export const testCider = (): Promise<CiderStatus> => invoke<CiderStatus>('test_cider');

export const testLyricsSource = (id: string): Promise<string> =>
  invoke<string>('test_lyrics_source', { id });

export const setCiderToken = (token: string): Promise<void> =>
  invoke('set_cider_token', { token });

export const tapSyncStart = (): Promise<void> => invoke('tap_sync_start');

export const tapSyncRecord = (): Promise<void> => invoke('tap_sync_record');

export const tapSyncSave = (): Promise<void> => invoke('tap_sync_save');

export const tapSyncCancel = (): Promise<void> => invoke('tap_sync_cancel');

export const openPreferences = (): Promise<void> => invoke('open_preferences');

export const quitApp = (): Promise<void> => invoke('quit_app');

export const onState = (handler: (snapshot: Snapshot) => void): Promise<UnlistenFn> =>
  listen<Snapshot>('lyrica:state', (event) => handler(event.payload));

export const spotifyStatus = (): Promise<SpotifyStatus> =>
  invoke<SpotifyStatus>('spotify_status');

/// Starts the browser login; the result arrives on `lyrica:spotify`.
export const spotifyLink = (): Promise<void> => invoke('spotify_link');

export const spotifyUnlink = (): Promise<SpotifyStatus> =>
  invoke<SpotifyStatus>('spotify_unlink');

export const spotifyControl = (action: string, value?: string): Promise<void> =>
  invoke('spotify_control', { action, value: value ?? null });

/// Remembers the nudge and style for the current song, artist or album.
export const rememberSong = (scope: 'song' | 'artist' | 'album'): Promise<number> =>
  invoke<number>('remember_song', { scope });

export const forgetSong = (): Promise<number> => invoke<number>('forget_song');

export const qolTestRule = (rule: QolRule): Promise<boolean> =>
  invoke<boolean>('qol_test_rule', { rule });

export const qolSample = (): Promise<QolState> => invoke<QolState>('qol_sample');

export const sleepTimer = (minutes: number): Promise<void> =>
  invoke('sleep_timer', { minutes });

export const sleepPlaylistEnd = (armed: boolean): Promise<void> =>
  invoke('sleep_playlist_end', { armed });

export const setLightOverride = (mode: 'auto' | 'on' | 'off'): Promise<void> =>
  invoke('set_light_override', { mode });

export const reportFrameTime = (frameMs: number): Promise<void> =>
  invoke('report_frame_time', { frameMs });

export const onSpotify = (
  handler: (payload: { linked?: boolean; error?: string }) => void,
): Promise<UnlistenFn> =>
  listen<{ linked?: boolean; error?: string }>('lyrica:spotify', (event) =>
    handler(event.payload),
  );
