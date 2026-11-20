//! Persisted preferences, stored as JSON in the app config directory.

use crate::qol;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Rules that make the app quieter without being configured: games and
/// fullscreen video win the screen, meetings pause the ambient layer, and a
/// laptop on battery starts in Light mode. The late-evening schedule ships
/// switched off, because dimming someone's screen at 22:00 is a choice.
fn default_rules() -> Vec<qol::Rule> {
    vec![
        qol::Rule {
            id: "fullscreen-hide".into(),
            enabled: true,
            condition: "fullscreen".into(),
            value: String::new(),
            action: "hideOverlays".into(),
        },
        qol::Rule {
            id: "call-pause-ambient".into(),
            enabled: true,
            condition: "videoCall".into(),
            value: String::new(),
            action: "pauseAmbient".into(),
        },
        qol::Rule {
            id: "battery-light".into(),
            enabled: true,
            condition: "battery".into(),
            value: String::new(),
            action: "lightMode".into(),
        },
        qol::Rule {
            id: "evening-warm".into(),
            enabled: false,
            condition: "time".into(),
            value: "22:00-07:00".into(),
            action: "warmAmbient".into(),
        },
    ]
}

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
    /// Let the idle timer open Ambient by itself. Off by default: the hotkey and
    /// the toggle are the only things that show it unless this is turned on.
    pub ambient_auto_open: bool,
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
    /// Licensing is on; keys are verified offline against an embedded key.
    pub licensing_enabled: bool,
    /// Unix ms when the trial first started; 0 until the first launch.
    pub trial_started_ms: i64,
    /// Styles pinned to the tray menu, in order (at most five).
    pub pinned_styles: Vec<String>,
    /// Keep a taskbar button while the main window is open.
    pub show_in_taskbar: bool,
    /// Hold the display awake while lyrics are showing and music is playing.
    pub keep_awake: bool,
    /// Draw lyrics over normal desktop use, not only on the ambient screen.
    pub show_on_desktop: bool,
    /// Per-display lyric styles: monitor index → style id. Every entry opens a
    /// click-through overlay on that display with its own style.
    pub display_styles: std::collections::BTreeMap<String, String>,
    /// Which display the control page (style picker and settings) opens on.
    pub page_monitor: usize,
    /// Static layouts with crossfades only.
    pub reduce_motion: bool,
    /// No flashing, tearing or strobing, whatever the style does by default.
    pub photosensitive: bool,
    /// Shared effect toggles, keyed by effect id.
    pub style_effects: std::collections::BTreeMap<String, String>,
    /// Per-style options, keyed by "<styleId>.<option>".
    pub style_options: std::collections::BTreeMap<String, String>,
    /// A second window showing only the selected style, for OBS capture.
    pub stream_window: bool,
    /// "off", "chorus" or "songs": auto-switch styles from the pool.
    pub randomizer_mode: String,
    pub randomizer_every_songs: u32,
    pub randomizer_pool: Vec<String>,
    /// Pick the style pool from the song's energy.
    pub mood_mode: bool,
    /// Opt-in microphone scoring; nothing leaves the machine.
    pub sing_along: bool,
    pub color_auto_sync: bool,
    pub color_text: String,
    pub color_highlight: String,
    pub color_secondary: String,
    pub font_family: String,
    pub font_scale: f32,
    pub font_weight: u32,
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
    /// Spotify account linking. Empty client id means "not configured yet";
    /// tokens live in Credential Manager, not here.
    pub spotify_client_id: String,
    pub spotify_redirect_port: u16,
    pub spotify_controls: bool,
    pub spotify_account: String,
    pub spotify_product: String,
    pub spotify_expires_at_ms: i64,
    /// Experimental desktop scene, hosted in the wallpaper layer behind the icons.
    pub scene_enabled: bool,
    /// Rim Light: two-colour glow around the edge of the ambient display.
    pub rim_light_enabled: bool,
    /// Ring thickness in pixels, 2–24.
    pub rim_light_thickness: u32,
    /// 0..1: how far the glow spills inward.
    pub rim_light_glow: f32,
    /// "breathe", "drift" or "still".
    pub rim_light_animation: String,
    /// "style" takes the active style's colours, "custom" uses the two below.
    pub rim_light_colors: String,
    pub rim_light_color_a: String,
    pub rim_light_color_b: String,
    /// Cider (cider.sh) as an additional player source.
    pub cider_enabled: bool,
    pub cider_host: String,
    pub cider_port: u16,
    /// Use Cider's API for position/duration even when SMTC would do.
    pub cider_prefer_api: bool,
    /// Quality of life. One master switch, then one switch per behaviour.
    pub qol_enabled: bool,
    pub qol_song_memory: bool,
    pub qol_smart_hide: bool,
    /// Hide the lyrics after this many seconds paused; 0 disables.
    pub qol_hide_paused_seconds: u32,
    pub qol_no_lyrics_pill: bool,
    pub qol_instrumental_dots: bool,
    pub qol_hide_on_repeat: bool,
    /// Condition -> action rules, evaluated on the ambient ticker.
    pub qol_rules: Vec<qol::Rule>,
    /// "auto" (battery saver or slow frames), "on" or "off".
    pub qol_light_mode: String,
    pub qol_theme_follow: bool,
    /// Stop the ambient screen after this many minutes; 0 disables.
    pub qol_sleep_minutes: u32,
    /// Fullscreen apps that are allowed to keep the overlay (opted in).
    pub qol_allowlist: Vec<String>,
    /// Fullscreen apps that always send the overlay away.
    pub qol_denylist: Vec<String>,
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
            ambient_auto_open: false,
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
            licensing_enabled: true,
            trial_started_ms: 0,
            pinned_styles: Vec::new(),
            show_in_taskbar: false,
            keep_awake: true,
            show_on_desktop: true,
            display_styles: std::collections::BTreeMap::new(),
            page_monitor: 0,
            reduce_motion: false,
            photosensitive: false,
            style_effects: std::collections::BTreeMap::new(),
            style_options: std::collections::BTreeMap::new(),
            stream_window: false,
            randomizer_mode: "off".into(),
            randomizer_every_songs: 3,
            randomizer_pool: Vec::new(),
            mood_mode: false,
            sing_along: false,
            color_auto_sync: true,
            color_text: "#F5F7FF".into(),
            color_highlight: "#FF5C7A".into(),
            color_secondary: "#9AA3B2".into(),
            font_family: "Segoe UI Variable".into(),
            font_scale: 1.0,
            font_weight: 600,
            wallpaper_layer: false,
            hide_over_fullscreen: true,
            autostart: true,
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
            spotify_client_id: String::new(),
            spotify_redirect_port: 8888,
            spotify_controls: true,
            spotify_account: String::new(),
            spotify_product: String::new(),
            spotify_expires_at_ms: 0,
            scene_enabled: false,
            rim_light_enabled: true,
            rim_light_thickness: 12,
            rim_light_glow: 0.6,
            rim_light_animation: "breathe".into(),
            rim_light_colors: "style".into(),
            rim_light_color_a: "#8EF0C9".into(),
            rim_light_color_b: "#FF5C7A".into(),
            cider_enabled: false,
            cider_host: "localhost".into(),
            cider_port: 10_767,
            cider_prefer_api: true,
            qol_enabled: true,
            qol_song_memory: true,
            qol_smart_hide: true,
            qol_hide_paused_seconds: 12,
            qol_no_lyrics_pill: true,
            qol_instrumental_dots: true,
            qol_hide_on_repeat: false,
            qol_rules: default_rules(),
            qol_light_mode: "auto".into(),
            qol_theme_follow: true,
            qol_sleep_minutes: 0,
            qol_allowlist: Vec::new(),
            qol_denylist: Vec::new(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ambient_does_not_open_by_itself_by_default() {
        let settings = Settings::default();
        assert!(!settings.ambient_auto_open);
    }

    #[test]
    fn older_configs_pick_up_the_new_defaults() {
        // A settings file written before these fields existed.
        let raw = serde_json::json!({ "style": "ship", "ambientIdleMinutes": 1 });
        let settings: Settings = serde_json::from_value(raw).expect("old config still loads");
        assert!(!settings.ambient_auto_open, "idle timer must stay opt-in");
    }

    #[test]
    fn rim_light_settings_round_trip() {
        let mut settings = Settings::default();
        settings.ambient_auto_open = true;
        settings.rim_light_animation = "drift".into();
        let raw = serde_json::to_string(&settings).expect("serialises");
        let back: Settings = serde_json::from_str(&raw).expect("parses");
        assert_eq!(back.rim_light_animation, "drift");
        assert!(back.ambient_auto_open);
    }
}
