//! Quality-of-life: per-song memory, rule-based profiles, schedules, smart
//! hiding inputs, a sleep timer and a light performance mode.
//!
//! Everything here is optional and driven by `settings.qol_enabled`. Detection
//! runs on the existing two-second ticker, so idle cost is one cheap Win32 call
//! every other second rather than a new thread with its own cadence.

use crate::media::Playback;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

// ------------------------------------------------------------- song memory

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub nudge_ms: i64,
    pub style: Option<String>,
    pub updated_ms: i64,
}

/// Per-track memory, keyed by title/artist/duration, plus the artist and album
/// keys the quick toggles write to.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongMemory {
    #[serde(default)]
    pub entries: BTreeMap<String, MemoryEntry>,
}

/// Keeps the file bounded; old entries are dropped when it grows past this.
const MEMORY_LIMIT: usize = 4_000;

fn normalise(text: &str) -> String {
    text.trim().to_lowercase()
}

/// Stable across players, because it never includes the app or the track id.
pub fn song_key(playback: &Playback) -> String {
    format!(
        "song:{}|{}|{}",
        normalise(&playback.title),
        normalise(&playback.artist),
        (playback.duration_ms / 1000).max(0)
    )
}

pub fn artist_key(playback: &Playback) -> String {
    format!("artist:{}", normalise(&playback.artist))
}

pub fn album_key(playback: &Playback) -> String {
    format!("album:{}|{}", normalise(&playback.artist), normalise(&playback.album))
}

impl SongMemory {
    pub fn load(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &Path) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(text) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(path, text);
        }
    }

    pub fn get(&self, key: &str) -> Option<&MemoryEntry> {
        self.entries.get(key)
    }

    /// The nearest memory for a track: the song itself first, then the album,
    /// then the artist. Only the nudge is inherited from the wider scopes.
    pub fn resolve(&self, playback: &Playback) -> Option<MemoryEntry> {
        let song = self.entries.get(&song_key(playback));
        let album = self.entries.get(&album_key(playback));
        let artist = self.entries.get(&artist_key(playback));

        let nudge = song
            .map(|entry| entry.nudge_ms)
            .or_else(|| album.map(|entry| entry.nudge_ms))
            .or_else(|| artist.map(|entry| entry.nudge_ms))
            .unwrap_or(0);
        let style = song
            .and_then(|entry| entry.style.clone())
            .or_else(|| album.and_then(|entry| entry.style.clone()))
            .or_else(|| artist.and_then(|entry| entry.style.clone()));

        (nudge != 0 || style.is_some()).then(|| MemoryEntry {
            nudge_ms: nudge,
            style,
            updated_ms: song.map(|entry| entry.updated_ms).unwrap_or(0),
        })
    }

    /// Writes one scope. `scope` is "song", "artist" or "album"; anything else
    /// falls back to the song.
    pub fn remember(
        &mut self,
        playback: &Playback,
        scope: &str,
        nudge_ms: i64,
        style: Option<&str>,
        now_ms: i64,
    ) -> String {
        let key = match scope {
            "artist" => artist_key(playback),
            "album" => album_key(playback),
            _ => song_key(playback),
        };

        let entry = self.entries.entry(key.clone()).or_default();
        entry.nudge_ms = nudge_ms;
        if let Some(style) = style {
            entry.style = Some(style.to_string());
        }
        entry.updated_ms = now_ms;

        if self.entries.len() > MEMORY_LIMIT {
            let mut oldest: Vec<(String, i64)> = self
                .entries
                .iter()
                .map(|(key, entry)| (key.clone(), entry.updated_ms))
                .collect();
            oldest.sort_by_key(|(_, updated)| *updated);
            for (key, _) in oldest.into_iter().take(self.entries.len() - MEMORY_LIMIT) {
                self.entries.remove(&key);
            }
        }

        key
    }

    pub fn forget(&mut self, playback: &Playback) -> usize {
        let keys = [song_key(playback), artist_key(playback), album_key(playback)];
        keys.iter().filter(|key| self.entries.remove(*key).is_some()).count()
    }
}

// ------------------------------------------------------------------- rules

/// Conditions a rule can test. Kept as strings so the settings file stays
/// readable and a new condition never breaks an old one.
pub const CONDITIONS: &[(&str, &str)] = &[
    ("fullscreen", "A fullscreen game or app is focused"),
    ("app", "A named app is in front (comma separated process names)"),
    ("battery", "The laptop is on battery"),
    ("videoCall", "A video call is happening (Teams, Zoom, Webex)"),
    ("screenShare", "Screen sharing or recording is happening"),
    ("time", "Between two times of day (22:00-07:00)"),
];

pub const ACTIONS: &[(&str, &str)] = &[
    ("hideOverlays", "Hide the lyrics overlay"),
    ("lightMode", "Use Light mode"),
    ("pauseAmbient", "Pause the ambient screen"),
    ("streamingMode", "Switch on Streaming mode"),
    ("warmAmbient", "Dim and warm the ambient screen"),
];

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    #[serde(default)]
    pub id: String,
    #[serde(default = "yes")]
    pub enabled: bool,
    #[serde(default)]
    pub condition: String,
    /// The condition's argument: process names or a "HH:MM-HH:MM" window.
    #[serde(default)]
    pub value: String,
    #[serde(default)]
    pub action: String,
}

fn yes() -> bool {
    true
}

/// What the environment looks like right now. Pure data, so matching is trivial
/// to test without a desktop.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Env {
    pub process: String,
    pub fullscreen: bool,
    pub on_battery: bool,
    pub battery_saver: bool,
    pub video_call: bool,
    pub screen_share: bool,
    /// Minutes since midnight, local time.
    pub minutes: u32,
}

pub fn split_processes(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(|name| {
            name.trim()
                .trim_end_matches(".exe")
                .to_lowercase()
        })
        .filter(|name| !name.is_empty())
        .collect()
}

/// True for fullscreen work that should be left alone. A process in the
/// allowlist is opted in and keeps the overlay; a denylisted one always hides.
pub fn should_hide_over(env: &Env, allowlist: &[String], denylist: &[String]) -> bool {
    if !env.fullscreen {
        return false;
    }
    let process = env.process.trim_end_matches(".exe").to_lowercase();
    if allowlist.iter().any(|name| name.eq_ignore_ascii_case(&process)) {
        return false;
    }
    true
}

/// "22:00-07:00" or "09:30-17:00". Malformed windows never match.
pub fn in_window(value: &str, minutes: u32) -> bool {
    let Some((start, end)) = value.split_once('-') else {
        return false;
    };
    let parse = |text: &str| -> Option<u32> {
        let (hours, mins) = text.trim().split_once(':')?;
        let hours: u32 = hours.trim().parse().ok()?;
        let mins: u32 = mins.trim().parse().ok()?;
        (hours < 24 && mins < 60).then_some(hours * 60 + mins)
    };
    let (Some(start), Some(end)) = (parse(start), parse(end)) else {
        return false;
    };
    if start == end {
        return true;
    }
    if start < end {
        minutes >= start && minutes < end
    } else {
        minutes >= start || minutes < end
    }
}

/// A call needs a meeting client in front *and* a call window: the client itself
/// sits in the foreground all day (Teams in the tray, Discord in the taskbar),
/// and treating that as a call shut the ambient screen off permanently. Discord
/// is left out entirely — its window says nothing about a call being live.
pub fn is_video_call(process: &str, title: &str) -> bool {
    let name = process.trim_end_matches(".exe").to_lowercase();
    let meeting_app = matches!(
        name.as_str(),
        "teams" | "ms-teams" | "zoom" | "webex" | "webexmta" | "gotomeeting"
    );
    if !meeting_app {
        return false;
    }
    let title = title.to_lowercase();
    ["meeting", "call", "webinar", "huddle", "sharing"]
        .iter()
        .any(|word| title.contains(word))
}

/// Screen sharing is inferred from the app that owns the screen while it shares:
/// the share runs inside the same meeting process, or inside a recorder. This is
/// a heuristic, and the README says so.
pub fn is_screen_share(process: &str) -> bool {
    matches!(
        process.trim_end_matches(".exe").to_lowercase().as_str(),
        "teams" | "ms-teams" | "zoom" | "webex" | "obs64" | "obs32" | "streamlabs" | "xsplit.core"
    )
}

pub fn rule_matches(rule: &Rule, env: &Env) -> bool {
    if !rule.enabled || rule.condition.is_empty() || rule.action.is_empty() {
        return false;
    }
    match rule.condition.as_str() {
        "fullscreen" => env.fullscreen,
        "app" => {
            let process = env.process.trim_end_matches(".exe").to_lowercase();
            !process.is_empty() && split_processes(&rule.value).iter().any(|name| *name == process)
        }
        "battery" => env.on_battery,
        "videoCall" => env.video_call,
        "screenShare" => env.screen_share,
        "time" => in_window(&rule.value, env.minutes),
        _ => false,
    }
}

/// Every action the rules currently ask for, in a stable order.
pub fn active_actions(rules: &[Rule], env: &Env) -> Vec<String> {
    let mut actions: Vec<String> = Vec::new();
    for rule in rules {
        if rule_matches(rule, env) && !actions.contains(&rule.action) {
            actions.push(rule.action.clone());
        }
    }
    actions
}

// -------------------------------------------------------------- detection

#[cfg(windows)]
mod win {
    use super::{is_screen_share, is_video_call, Env};
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    type Hwnd = isize;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct MonitorInfo {
        cb_size: u32,
        rc_monitor: Rect,
        rc_work: Rect,
        flags: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct SystemPowerStatus {
        ac_line_status: u8,
        battery_flag: u8,
        battery_life_percent: u8,
        system_status_flag: u8,
        battery_life_time: u32,
        battery_full_life_time: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> Hwnd;
        fn GetWindowTextW(window: Hwnd, text: *mut u16, max: i32) -> i32;
        fn GetWindowThreadProcessId(window: Hwnd, process_id: *mut u32) -> u32;
        fn GetWindowRect(window: Hwnd, rect: *mut Rect) -> i32;
        fn GetWindowLongW(window: Hwnd, index: i32) -> i32;
        fn MonitorFromWindow(window: Hwnd, flags: u32) -> isize;
        fn GetMonitorInfoW(monitor: isize, info: *mut MonitorInfo) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, process_id: u32) -> isize;
        fn CloseHandle(handle: isize) -> i32;
        fn QueryFullProcessImageNameW(
            process: isize,
            flags: u32,
            buffer: *mut u16,
            size: *mut u32,
        ) -> i32;
        fn GetSystemPowerStatus(status: *mut SystemPowerStatus) -> i32;
    }

    const GWL_STYLE: i32 = -16;
    const WS_POPUP: i32 = 0x8000_0000u32 as i32;
    const WS_CAPTION: i32 = 0x00C0_0000;
    const MONITOR_DEFAULTTONEAREST: u32 = 2;

    fn process_name(process_id: u32) -> String {
        if process_id == 0 {
            return String::new();
        }
        unsafe {
            let handle = OpenProcess(0x1000, 0, process_id); // PROCESS_QUERY_LIMITED_INFORMATION
            if handle == 0 {
                return String::new();
            }
            let mut buffer = [0u16; 1024];
            let mut size = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut size);
            CloseHandle(handle);
            if ok == 0 {
                return String::new();
            }
            let path = OsString::from_wide(&buffer[..size as usize])
                .to_string_lossy()
                .to_string();
            path.rsplit(['\\', '/'])
                .next()
                .unwrap_or_default()
                .to_lowercase()
        }
    }

    fn window_title(window: Hwnd) -> String {
        if window == 0 {
            return String::new();
        }
        let mut buffer = [0u16; 512];
        let len = unsafe { GetWindowTextW(window, buffer.as_mut_ptr(), buffer.len() as i32) };
        if len <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buffer[..len as usize])
    }

    fn covers_monitor(window: Hwnd) -> bool {
        unsafe {
            let mut rect = Rect::default();
            if GetWindowRect(window, &mut rect) == 0 {
                return false;
            }
            let monitor = MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST);
            if monitor == 0 {
                return false;
            }
            let mut info = MonitorInfo {
                cb_size: std::mem::size_of::<MonitorInfo>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(monitor, &mut info) == 0 {
                return false;
            }
            let area = &info.rc_monitor;
            rect.left <= area.left
                && rect.top <= area.top
                && rect.right >= area.right
                && rect.bottom >= area.bottom
        }
    }

    pub fn sample() -> Env {
        unsafe {
            let foreground = GetForegroundWindow();
            let mut process_id = 0u32;
            if foreground != 0 {
                GetWindowThreadProcessId(foreground, &mut process_id);
            }
            let process = process_name(process_id);
            let title = window_title(foreground);
            let style = if foreground != 0 {
                GetWindowLongW(foreground, GWL_STYLE) as u32
            } else {
                0
            };
            let borderless = style & (WS_POPUP as u32) != 0 && style & (WS_CAPTION as u32) == 0;
            let fullscreen = foreground != 0
                && process_id != std::process::id()
                && covers_monitor(foreground)
                && borderless;

            let mut power = SystemPowerStatus::default();
            let (mut on_battery, mut battery_saver) = (false, false);
            if GetSystemPowerStatus(&mut power) != 0 {
                on_battery = power.ac_line_status == 0;
                battery_saver = power.system_status_flag & 1 != 0;
            }

            let now = chrono_minutes();
            Env {
                video_call: is_video_call(&process, &title),
                screen_share: is_screen_share(&process),
                process,
                fullscreen,
                on_battery,
                battery_saver,
                minutes: now,
            }
        }
    }

    /// Local minutes since midnight without pulling in a date crate.
    extern "system" {
        fn GetLocalTime(system_time: *mut SystemTime);
    }

    #[repr(C)]
    #[derive(Default)]
    struct SystemTime {
        year: u16,
        month: u16,
        day_of_week: u16,
        day: u16,
        hour: u16,
        minute: u16,
        second: u16,
        milliseconds: u16,
    }

    fn chrono_minutes() -> u32 {
        unsafe {
            let mut time = SystemTime::default();
            GetLocalTime(&mut time);
            time.hour as u32 * 60 + time.minute as u32
        }
    }
}

/// Reads the desktop state. On other platforms this is inert so the tests and
/// the frontend keep working.
pub fn sample() -> Env {
    #[cfg(windows)]
    {
        win::sample()
    }
    #[cfg(not(windows))]
    {
        Env::default()
    }
}

// ------------------------------------------------------------- light mode

/// Rolling frame-time check: five slow frames in a row is a jank signal, not a
/// single hitch.
#[derive(Default)]
pub struct LoadWatch {
    slow: u8,
    /// Sticky until frames are healthy again, so Light mode does not flicker.
    pub tripped: bool,
}

impl LoadWatch {
    pub fn report(&mut self, frame_ms: f32) -> bool {
        if frame_ms >= 26.0 {
            self.slow = self.slow.saturating_add(1);
        } else if frame_ms < 20.0 {
            self.slow = 0;
            self.tripped = false;
        }
        if self.slow >= 5 {
            self.tripped = true;
        }
        self.tripped
    }
}

// ------------------------------------------------------------------ sleep

/// When a sleep timer is armed and why. Milliseconds, so it can drive a fade.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepState {
    pub until_ms: i64,
    pub after_playlist: bool,
    pub fading: bool,
}

pub fn sleep_reached(state: &SleepState, now_ms: i64) -> bool {
    state.until_ms > 0 && now_ms >= state.until_ms
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(title: &str, artist: &str, album: &str, duration_ms: i64) -> Playback {
        Playback {
            app: "Spotify".into(),
            title: title.into(),
            artist: artist.into(),
            album: album.into(),
            status: "playing".into(),
            position_ms: 0,
            duration_ms,
            sampled_at_ms: 0,
        }
    }

    #[test]
    fn keys_ignore_case_and_player() {
        let a = track("Invented Song", "Invented Band", "Record", 200_000);
        let mut b = a.clone();
        b.title = "  invented song ".into();
        b.artist = "INVENTED BAND".into();
        b.app = "Apple Music".into();
        assert_eq!(song_key(&a), song_key(&b));
        assert_eq!(artist_key(&a), artist_key(&b));
    }

    #[test]
    fn the_song_beats_the_album_which_beats_the_artist() {
        let mut memory = SongMemory::default();
        let playback = track("Song", "Band", "Album", 100_000);

        memory.remember(&playback, "artist", 300, None, 1);
        assert_eq!(memory.resolve(&playback).unwrap().nudge_ms, 300);

        memory.remember(&playback, "album", 200, None, 2);
        assert_eq!(memory.resolve(&playback).unwrap().nudge_ms, 200);

        memory.remember(&playback, "song", 100, Some("web"), 3);
        let entry = memory.resolve(&playback).unwrap();
        assert_eq!(entry.nudge_ms, 100);
        assert_eq!(entry.style.as_deref(), Some("web"));
    }

    #[test]
    fn the_artist_style_shows_through_for_other_songs() {
        let mut memory = SongMemory::default();
        let one = track("One", "Band", "Album", 100_000);
        memory.remember(&one, "artist", 0, Some("constellation"), 1);

        let two = track("Two", "Band", "Other Album", 90_000);
        assert_eq!(
            memory.resolve(&two).unwrap().style.as_deref(),
            Some("constellation")
        );
        assert_eq!(memory.resolve(&two).unwrap().nudge_ms, 0);
    }

    #[test]
    fn forgetting_clears_all_three_scopes() {
        let mut memory = SongMemory::default();
        let playback = track("Song", "Band", "Album", 100_000);
        memory.remember(&playback, "song", 10, None, 1);
        memory.remember(&playback, "artist", 10, None, 1);
        memory.remember(&playback, "album", 10, None, 1);
        assert_eq!(memory.forget(&playback), 3);
        assert!(memory.resolve(&playback).is_none());
    }

    #[test]
    fn memory_is_pruned_when_it_grows() {
        let mut memory = SongMemory::default();
        for index in 0..(MEMORY_LIMIT + 20) {
            memory.remember(
                &track(&format!("Song {index}"), "Band", "Album", 100_000),
                "song",
                1,
                None,
                index as i64,
            );
        }
        assert_eq!(memory.entries.len(), MEMORY_LIMIT);
        // The oldest went first.
        assert!(!memory
            .entries
            .keys()
            .any(|key| key.contains("song 0|")));
    }

    #[test]
    fn time_windows_wrap_past_midnight() {
        assert!(in_window("22:00-07:00", 23 * 60));
        assert!(in_window("22:00-07:00", 6 * 60));
        assert!(!in_window("22:00-07:00", 12 * 60));
        assert!(in_window("09:30-17:00", 10 * 60));
        assert!(!in_window("09:30-17:00", 18 * 60));
        assert!(!in_window("bad", 10));
        assert!(!in_window("25:00-26:00", 10));
    }

    fn env() -> Env {
        Env {
            process: "game".into(),
            fullscreen: true,
            on_battery: false,
            battery_saver: false,
            video_call: false,
            screen_share: false,
            minutes: 12 * 60,
        }
    }

    #[test]
    fn rules_fire_only_when_they_match_and_are_enabled() {
        let rules = vec![
            Rule {
                id: "a".into(),
                enabled: true,
                condition: "fullscreen".into(),
                value: String::new(),
                action: "hideOverlays".into(),
            },
            Rule {
                id: "b".into(),
                enabled: false,
                condition: "fullscreen".into(),
                value: String::new(),
                action: "lightMode".into(),
            },
            Rule {
                id: "c".into(),
                enabled: true,
                condition: "app".into(),
                value: "chrome, GAME.exe".into(),
                action: "streamingMode".into(),
            },
        ];
        let actions = active_actions(&rules, &env());
        assert_eq!(actions, vec!["hideOverlays", "streamingMode"]);
    }

    #[test]
    fn an_opted_in_game_keeps_the_overlay() {
        let mut env = env();
        let allow = vec!["game".to_string()];
        assert!(!should_hide_over(&env, &allow, &[]));

        env.process = "other".into();
        assert!(should_hide_over(&env, &allow, &[]));

        env.fullscreen = false;
        assert!(!should_hide_over(&env, &allow, &[]));
    }

    #[test]
    fn meeting_and_sharing_apps_are_recognised() {
        assert!(is_video_call("Teams.exe", "Meeting with Sam | Microsoft Teams"));
        assert!(is_video_call("zoom", "Zoom Meeting"));
        assert!(!is_video_call("Teams.exe", "Chat | Microsoft Teams"));
        assert!(!is_video_call("discord", "Discord"));
        assert!(!is_video_call("chrome", "YouTube"));
        assert!(is_screen_share("obs64.exe"));
        assert!(is_screen_share("ms-teams"));
    }

    #[test]
    fn light_mode_needs_a_run_of_slow_frames() {
        let mut watch = LoadWatch::default();
        for _ in 0..4 {
            assert!(!watch.report(30.0));
        }
        assert!(watch.report(30.0));
        // Still tripped while frames are merely mid-range.
        assert!(watch.report(22.0));
        // One smooth frame clears it.
        assert!(!watch.report(10.0));
        assert!(!watch.report(10.0));
    }

    #[test]
    fn sleep_fires_once_the_deadline_passes() {
        let state = SleepState {
            until_ms: 1_000,
            ..Default::default()
        };
        assert!(!sleep_reached(&state, 999));
        assert!(sleep_reached(&state, 1_000));
        assert!(!sleep_reached(&SleepState::default(), 10_000));
    }
}
