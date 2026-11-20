import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CiderStatus, Settings, Snapshot } from '../types';

export const getState = (): Promise<Snapshot> => invoke<Snapshot>('get_state');

export const setStyle = (style: string): Promise<void> => invoke('set_style', { style });

export const updateSettings = (patch: Settings): Promise<void> =>
  invoke('update_settings', { patch });

export const nudge = (deltaMs: number): Promise<void> => invoke('nudge', { deltaMs });

export const togglePlayPause = (): Promise<void> => invoke('toggle_play_pause');

export const setAmbientMode = (enabled: boolean): Promise<void> =>
  invoke('set_ambient_mode', { enabled });

export const setWallpaperLayer = (enabled: boolean): Promise<void> =>
  invoke('set_wallpaper_layer', { enabled });

export const reloadLyrics = (): Promise<void> => invoke('reload_lyrics');

export const testCider = (): Promise<CiderStatus> => invoke<CiderStatus>('test_cider');

export const setCiderToken = (token: string): Promise<void> =>
  invoke('set_cider_token', { token });

export const openPreferences = (): Promise<void> => invoke('open_preferences');

export const quitApp = (): Promise<void> => invoke('quit_app');

export const onState = (handler: (snapshot: Snapshot) => void): Promise<UnlistenFn> =>
  listen<Snapshot>('lyrica:state', (event) => handler(event.payload));
