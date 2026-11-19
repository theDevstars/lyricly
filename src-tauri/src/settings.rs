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
    pub wallpaper_layer: bool,
    pub hide_over_fullscreen: bool,
    pub autostart: bool,
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
            wallpaper_layer: false,
            hide_over_fullscreen: true,
            autostart: false,
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
