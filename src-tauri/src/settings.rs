//! Persisted preferences, stored as JSON in the app config directory.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub monitor: String,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 40,
            y: 40,
            width: 760,
            height: 300,
            monitor: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub style: String,
    /// Manual sync offset applied to lyric times.
    pub nudge_ms: i64,
    pub opacity: f32,
    pub ambient_enabled: bool,
    pub ambient_monitor: usize,
    pub ambient_idle_minutes: u32,
    pub ambient_hotkey: String,
    /// Hotkey that records the start of the next lyric line while tap-syncing.
    pub tap_sync_hotkey: String,
    /// Hide the lyrics from screen capture (OBS, Discord, Teams, recorders).
    pub stream_safe: bool,
    pub stream_safe_hotkey: String,
    /// Late Night ambient screen: a lock-screen-styled takeover on the monitor.
    pub late_night_hotkey: String,
    /// Open after this many idle minutes while music plays; 0 disables.
    pub late_night_idle_minutes: u32,
    pub late_night_on_play: bool,
    /// "primary" (one monitor) or "all" (mirror every monitor).
    pub late_night_mode: String,
    pub late_night_monitor: usize,
    /// "black" or "dim".
    pub late_night_background: String,
    pub late_night_clock: bool,
    pub late_night_24h: bool,
    pub late_night_click_through: bool,
    pub late_night_hide_fullscreen: bool,
    pub late_night_keep_awake: bool,
    pub late_night_resume_after_unlock: bool,
    pub wallpaper_layer: bool,
    pub hide_over_fullscreen: bool,
    pub autostart: bool,
    /// Genius text comes from its song pages, which is terms-sensitive:
    /// off unless the user explicitly agrees.
    pub lyrics_allow_genius_page_parsing: bool,
    /// Lyric sources in the user's priority order.
    pub lyrics_provider_order: Vec<String>,
    pub lyrics_providers_enabled: Vec<String>,
    pub lyrics_prefer_synced: bool,
    pub lyrics_confidence_threshold: f32,
    pub lyrics_auto_estimate: bool,
    /// Cider (cider.sh) as an additional player source.
    pub cider_enabled: bool,
    pub cider_host: String,
    pub cider_port: u16,
    /// Use Cider's API for position/duration even when SMTC would do.
    pub cider_prefer_api: bool,
    pub window: WindowState,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            style: "ship".into(),
            nudge_ms: 0,
            opacity: 0.92,
            ambient_enabled: false,
            ambient_monitor: 0,
            ambient_idle_minutes: 10,
            ambient_hotkey: "Ctrl+Alt+L".into(),
            tap_sync_hotkey: "Ctrl+Alt+T".into(),
            stream_safe: false,
            stream_safe_hotkey: "Ctrl+Alt+S".into(),
            late_night_hotkey: "Ctrl+Alt+K".into(),
            late_night_idle_minutes: 0,
            late_night_on_play: false,
            late_night_mode: "primary".into(),
            late_night_monitor: 0,
            late_night_background: "black".into(),
            late_night_clock: true,
            late_night_24h: true,
            late_night_click_through: false,
            late_night_hide_fullscreen: true,
            late_night_keep_awake: true,
            late_night_resume_after_unlock: true,
            wallpaper_layer: false,
            hide_over_fullscreen: true,
            autostart: false,
            lyrics_allow_genius_page_parsing: false,
            lyrics_provider_order: vec![
                "cider".into(),
                "local".into(),
                "lrclib".into(),
                "musixmatch".into(),
                "genius".into(),
            ],
            lyrics_providers_enabled: vec!["cider".into(), "local".into(), "lrclib".into()],
            lyrics_prefer_synced: true,
            lyrics_confidence_threshold: 0.6,
            lyrics_auto_estimate: true,
            cider_enabled: false,
            cider_host: "localhost".into(),
            cider_port: 10_767,
            cider_prefer_api: true,
            window: WindowState::default(),
        }
    }
}

impl Settings {
    pub fn load(path: &PathBuf) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Settings>(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &PathBuf) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        if let Ok(raw) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(path, raw);
        }
    }
}
