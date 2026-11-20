mod accounts;
mod credentials;
mod license;
mod lyrics;
mod media;
mod overlay;
mod players;
mod qol;
mod settings;
mod tray;

#[cfg(windows)]
mod autostart;

use lyrics::{Lyrics, TrackQuery};
use media::{now_ms, Playback};
use settings::{Settings, WindowState};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, State,
    WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Window geometry is written to disk at most this often while dragging.
static LAST_GEOMETRY_SAVE: AtomicI64 = AtomicI64::new(0);

const POLL_MS: u64 = 250;

/// The last Spotify Web API sample plus the last error, if any. Kept next to
/// the runtime so the poller can prefer it over SMTC while it is fresh.
#[derive(Default)]
pub struct SpotifyState {
    pub sample: Option<accounts::spotify::SpotifyPlayback>,
    pub error: Option<String>,
    pub device: Option<String>,
}

pub struct Runtime {
    pub settings: Settings,
    pub playback: Playback,
    pub lyrics: Option<Lyrics>,
    pub track_key: String,
    pub loading: bool,
    pub ambient_on: bool,
    /// True when the idle timer opened ambient, so only that one closes on activity.
    pub ambient_auto: bool,
    /// When ambient was last shown, so the keypress that opened it is not activity.
    pub ambient_opened_ms: i64,
    /// True when the floating overlay was hidden for the ambient screen, so it
    /// comes back when ambient closes.
    pub overlay_hidden: bool,
    pub error: Option<String>,
    /// Why capture exclusion could not be applied, if it failed.
    pub stream_safe_error: Option<String>,
    /// Whether the Late Night ambient screen is up.
    pub late_night: bool,
    /// An in-progress tap-to-sync run, if any.
    pub tap: Option<TapSession>,
    /// Transient quality-of-life state (never persisted).
    pub qol: QolRuntime,
}

/// Lines and recorded line starts for the track being tap-synced.
pub struct TapSession {
    key: String,
    lines: Vec<String>,
    taps: Vec<i64>,
    duration_ms: i64,
}

pub struct Shared {
    pub runtime: Mutex<Runtime>,
    pub cache: Arc<lyrics::cache::Cache>,
    pub pipeline: Arc<lyrics::Pipeline>,
    /// Live switch for Genius page parsing, so the preference applies without a restart.
    pub genius_parsing: Arc<AtomicBool>,
    /// Cider connection settings, shared by the player source and the lyrics provider.
    pub cider: Arc<RwLock<players::cider::CiderConfig>>,
    /// Last linked-account sample (Spotify today), read by the player poller.
    pub spotify: Arc<Mutex<SpotifyState>>,
    /// Per-song nudge and style memory, persisted beside the settings file.
    pub memory: Arc<Mutex<qol::SongMemory>>,
}

/// Transient quality-of-life state: what the rules asked for, how loaded the
/// renderer is, and when the ambient screen should go to sleep. None of this is
/// saved — the user's own settings stay untouched.
#[derive(Default)]
pub struct QolRuntime {
    pub env: qol::Env,
    pub actions: Vec<String>,
    pub light_mode: bool,
    pub notice: Option<String>,
    pub sleep: qol::SleepState,
    pub repeated: u32,
    pub load: qol::LoadWatch,
    pub override_light: Option<bool>,
    pub capture_override: bool,
    pub was_playing: bool,
    pub quiet_ticks: u32,
    pub signature: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct QolView {
    enabled: bool,
    light_mode: bool,
    light_override: Option<bool>,
    hide_overlays: bool,
    dim_ambient: bool,
    process: String,
    fullscreen: bool,
    on_battery: bool,
    battery_saver: bool,
    video_call: bool,
    screen_share: bool,
    notice: Option<String>,
    sleep_until_ms: i64,
    sleep_fading: bool,
    after_playlist: bool,
    repeated: u32,
    active_actions: Vec<String>,
    memory_size: usize,
    windows_light: bool,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    playback: Playback,
    settings: Settings,
    lyrics: Option<Lyrics>,
    track_key: String,
    loading: bool,
    ambient_on: bool,
    error: Option<String>,
    stream_safe: bool,
    stream_safe_error: Option<String>,
    late_night: bool,
    tap_sync: Option<TapStatus>,
    qol: QolView,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TapStatus {
    active: bool,
    recorded: usize,
    total: usize,
}

impl TapStatus {
    fn of(session: &TapSession) -> Self {
        Self {
            active: true,
            recorded: session.taps.len(),
            total: session.lines.len(),
        }
    }
}

fn config_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("settings.json")
}

fn db_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("lyrica.sqlite3")
}

fn snapshot(state: &Shared) -> Snapshot {
    let runtime = state.runtime.lock().expect("runtime lock");
    Snapshot {
        playback: runtime.playback.clone(),
        settings: runtime.settings.clone(),
        lyrics: runtime.lyrics.clone(),
        track_key: runtime.track_key.clone(),
        loading: runtime.loading,
        ambient_on: runtime.ambient_on,
        error: runtime.error.clone(),
        stream_safe: runtime.settings.stream_safe,
        stream_safe_error: runtime.stream_safe_error.clone(),
        late_night: runtime.late_night,
        tap_sync: runtime.tap.as_ref().map(TapStatus::of),
        qol: QolView {
            enabled: runtime.settings.qol_enabled,
            light_mode: runtime.qol.light_mode,
            light_override: runtime.qol.override_light,
            hide_overlays: runtime.qol.actions.iter().any(|action| action == "hideOverlays"),
            dim_ambient: runtime.qol.actions.iter().any(|action| action == "warmAmbient"),
            process: runtime.qol.env.process.clone(),
            fullscreen: runtime.qol.env.fullscreen,
            on_battery: runtime.qol.env.on_battery,
            battery_saver: runtime.qol.env.battery_saver,
            video_call: runtime.qol.env.video_call,
            screen_share: runtime.qol.env.screen_share,
            notice: runtime.qol.notice.clone(),
            sleep_until_ms: runtime.qol.sleep.until_ms,
            sleep_fading: runtime.qol.sleep.fading,
            after_playlist: runtime.qol.sleep.after_playlist,
            repeated: runtime.qol.repeated,
            active_actions: runtime.qol.actions.clone(),
            memory_size: state.memory.lock().map(|memory| memory.entries.len()).unwrap_or(0),
            windows_light: runtime.settings.qol_theme_follow && windows_light_theme(),
        },
    }
}

fn memory_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("song-memory.json")
}

fn emit_snapshot(app: &AppHandle) {
    let state = app.state::<Shared>();
    let payload = snapshot(&state);
    let _ = app.emit("lyrica:state", payload);
}

// ------------------------------------------------------------------ windows

pub fn show_lyrics_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("lyrics") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Settings live inside the lyrics window, so opening them means showing that
/// window and asking it to reveal the panel — no second window.
fn show_prefs(app: &AppHandle) {
    show_lyrics_window(app);
    let _ = app.emit("lyrica:open-settings", true);
}

fn ambient_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("ambient")
}

fn ensure_ambient_window(app: &AppHandle, monitor_index: usize) -> Option<WebviewWindow> {
    if let Some(window) = ambient_window(app) {
        return Some(window);
    }

    let monitor = app
        .available_monitors()
        .ok()
        .and_then(|monitors| monitors.get(monitor_index).cloned())
        .or_else(|| app.primary_monitor().ok().flatten())?;

    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let position = monitor.position().to_logical::<f64>(scale);

    let window = WebviewWindowBuilder::new(app, "ambient", tauri::WebviewUrl::App("index.html".into()))
        .title("Lyrica Ambient")
        .inner_size(size.width, size.height)
        .position(position.x, position.y)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .resizable(false)
        .visible(false)
        .build()
        .ok()?;

    let _ = window.set_ignore_cursor_events(true);

    #[cfg(windows)]
    if let Ok(handle) = window.hwnd() {
        overlay::make_click_through(handle.0 as isize);
        overlay::pin_topmost(handle.0 as isize);
        let capture = {
            let state = app.state::<Shared>();
            let runtime = state.runtime.lock().expect("runtime lock");
            runtime.settings.stream_safe
        };
        if capture {
            overlay::set_capture_hidden(handle.0 as isize, true);
        }
    }

    Some(window)
}

fn place_ambient(app: &AppHandle, monitor_index: usize) {
    let Some(window) = ambient_window(app) else {
        return;
    };
    let Ok(monitors) = app.available_monitors() else {
        return;
    };
    let Some(monitor) = monitors.get(monitor_index).or_else(|| monitors.first()) else {
        return;
    };

    // The monitor reports physical pixels; the window API wants them converted
    // once, not fed back as if they were already physical.
    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let position = monitor.position().to_logical::<f64>(scale);

    let _ = window.set_position(LogicalPosition::new(position.x, position.y));
    let _ = window.set_size(LogicalSize::new(size.width, size.height));
}

fn set_ambient(app: &AppHandle, on: bool) {
    set_ambient_with(app, on, false);
}

/// `auto` marks the idle timer's own screen, which steps aside the moment the
/// user comes back; anything the user asked for stays until they dismiss it.
fn set_ambient_with(app: &AppHandle, on: bool, auto: bool) {
    let monitor_index = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.ambient_monitor
    };

    if on {
        let Some(window) = ensure_ambient_window(app, monitor_index) else {
            return;
        };
        place_ambient(app, monitor_index);
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.show();

        #[cfg(windows)]
        if let Ok(handle) = window.hwnd() {
            overlay::pin_topmost(handle.0 as isize);
            overlay::show_without_focus(handle.0 as isize);
        }

        // Ambient is a whole-screen takeover: the floating overlay steps aside
        // so two opaque webviews are not stacked, one hiding the other.
        if let Some(lyrics) = app.get_webview_window("lyrics") {
            if lyrics.is_visible().unwrap_or(false) {
                let state = app.state::<Shared>();
                let mut runtime = state.runtime.lock().expect("runtime lock");
                runtime.overlay_hidden = true;
                drop(runtime);
                let _ = lyrics.hide();
            }
        }
    } else if let Some(window) = ambient_window(app) {
        let _ = window.hide();
        let restore = {
            let state = app.state::<Shared>();
            let mut runtime = state.runtime.lock().expect("runtime lock");
            std::mem::take(&mut runtime.overlay_hidden)
        };
        if restore {
            show_lyrics_window(app);
        }
    }

    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.ambient_on = on;
        runtime.ambient_auto = on && auto;
        if on {
            runtime.ambient_opened_ms = now_ms();
        }
    }

    let _ = app.emit("lyrica:ambient", on);
    emit_snapshot(app);
}

fn apply_wallpaper_layer(app: &AppHandle, enabled: bool) {
    #[cfg(windows)]
    {
        let Some(window) = ambient_window(app) else {
            return;
        };
        if let Ok(handle) = window.hwnd() {
            if enabled {
                overlay::attach_to_wallpaper(handle.0 as isize);
            } else {
                overlay::detach_from_wallpaper(handle.0 as isize);
            }
        }
    }
    let _ = app;
    let _ = enabled;
}

// ------------------------------------------------------------------ lyrics

enum LookupOutcome {
    /// Engine-ready lyrics, plus the source and timing wording for the status row.
    Found(Lyrics, String, String),
    Instrumental(String),
    Missing(String),
}

fn spawn_lyric_lookup(app: AppHandle, key: String, query: TrackQuery) {
    let _ = app.emit("lyrics:loading", serde_json::json!({ "trackKey": key }));

    tauri::async_runtime::spawn(async move {
        let pipeline = app.state::<Shared>().pipeline.clone();
        let outcome = pipeline.resolve(&query).await;

        let resolved = match outcome.result {
            Some(result) => {
                let source = result.source.clone();
                let timing = result.timing.label().to_string();
                match result.to_engine() {
                    Some(engine) => LookupOutcome::Found(engine, source, timing),
                    None if result.instrumental => LookupOutcome::Instrumental(source),
                    None => LookupOutcome::Missing(format!(
                        "{source} returned plain lyrics; timing estimation is not enabled yet"
                    )),
                }
            }
            None => LookupOutcome::Missing(
                outcome.reason.unwrap_or_else(|| "no lyrics found".into()),
            ),
        };

        {
            let state = app.state::<Shared>();
            let mut runtime = state.runtime.lock().expect("runtime lock");
            if runtime.track_key != key {
                // The track changed while we were waiting; drop this answer.
                return;
            }
            runtime.loading = false;
            match &resolved {
                LookupOutcome::Found(engine, _, _) => {
                    runtime.lyrics = Some(engine.clone());
                    runtime.error = None;
                }
                LookupOutcome::Instrumental(source) => {
                    runtime.lyrics = None;
                    runtime.error = Some(format!("instrumental track (from {source})"));
                }
                LookupOutcome::Missing(reason) => {
                    runtime.lyrics = None;
                    runtime.error = Some(reason.clone());
                }
            }
        }

        match resolved {
            LookupOutcome::Found(_, source, timing) => {
                let _ = app.emit(
                    "lyrics:found",
                    serde_json::json!({ "source": source, "timing": timing }),
                );
            }
            LookupOutcome::Instrumental(source) => {
                let _ = app.emit(
                    "lyrics:not_found",
                    serde_json::json!({ "reason": format!("instrumental track (from {source})") }),
                );
            }
            LookupOutcome::Missing(reason) => {
                let _ = app.emit("lyrics:not_found", serde_json::json!({ "reason": reason }));
            }
        }

        emit_snapshot(&app);
    });
}

// ------------------------------------------------------- late night ambient

const LATE_NIGHT_PREFIX: &str = "late-night-";

fn late_night_settings(app: &AppHandle) -> (String, usize, bool) {
    let state = app.state::<Shared>();
    let runtime = state.runtime.lock().expect("runtime lock");
    (
        runtime.settings.late_night_mode.clone(),
        runtime.settings.late_night_monitor,
        runtime.settings.late_night_click_through,
    )
}

/// One entry per monitor the screen should cover: the chosen one, or all of
/// them (mirror).
fn late_night_targets(app: &AppHandle) -> Vec<(usize, tauri::Monitor)> {
    let Ok(monitors) = app.available_monitors() else {
        return Vec::new();
    };
    if monitors.is_empty() {
        return Vec::new();
    }

    let (mode, chosen, _) = late_night_settings(app);
    if mode == "all" {
        return monitors.into_iter().enumerate().collect();
    }

    let index = chosen.min(monitors.len() - 1);
    monitors
        .into_iter()
        .enumerate()
        .filter(|(position, _)| *position == index)
        .collect()
}

fn place_late_night(window: &WebviewWindow, monitor: &tauri::Monitor) {
    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let position = monitor.position().to_logical::<f64>(scale);
    let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
    let _ = window.set_size(PhysicalSize::new(size.width, size.height));
}

/// Creates, places and prunes the full-screen windows. Safe to call repeatedly:
/// it also picks up monitor hotplug, DPI and resolution changes.
fn sync_late_night_windows(app: &AppHandle) {
    let targets = late_night_targets(app);
    if targets.is_empty() {
        return;
    }

    let (_, _, click_through) = late_night_settings(app);
    let mut wanted: Vec<String> = Vec::new();
    let mut focused = false;

    for (index, monitor) in targets {
        let label = format!("{LATE_NIGHT_PREFIX}{index}");
        wanted.push(label.clone());

        let window = match app.get_webview_window(&label) {
            Some(window) => window,
            None => {
                let scale = monitor.scale_factor();
                let size = monitor.size().to_logical::<f64>(scale);
                let position = monitor.position().to_logical::<f64>(scale);
                let built = WebviewWindowBuilder::new(
                    app,
                    &label,
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("Lyrica Late Night")
                .inner_size(size.width, size.height)
                .position(position.x, position.y)
                .decorations(false)
                .transparent(false)
                .shadow(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false)
                .focused(false)
                .build();

                match built {
                    Ok(window) => window,
                    Err(error) => {
                        eprintln!("late night window: {error}");
                        continue;
                    }
                }
            }
        };

        place_late_night(&window, &monitor);
        let _ = window.set_ignore_cursor_events(click_through);
        let _ = window.show();

        #[cfg(windows)]
        if let Ok(handle) = window.hwnd() {
            overlay::pin_topmost(handle.0 as isize);
        }

        // Keyboard exit needs focus; click-through mode deliberately never
        // takes it.
        if !click_through && !focused {
            let _ = window.set_focus();
            focused = true;
        }
    }

    for (label, window) in app.webview_windows() {
        if label.starts_with(LATE_NIGHT_PREFIX) && !wanted.contains(&label) {
            let _ = window.destroy();
        }
    }
}

fn close_late_night(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(LATE_NIGHT_PREFIX) {
            let _ = window.destroy();
        }
    }
}

fn apply_late_night(app: &AppHandle, on: bool) {
    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.late_night = on;
    }

    if on {
        // Both are full-screen overlays; the lyric layer steps aside.
        set_ambient(app, false);
        sync_late_night_windows(app);
    } else {
        close_late_night(app);
    }

    sync_tray(app);
    emit_snapshot(app);
}

// ------------------------------------------------------- capture exclusion

/// Applies (or clears) capture exclusion on every Lyric window. WebView2 paints
/// through child windows, which `set_capture_hidden` covers too.
fn apply_stream_safe(app: &AppHandle, on: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut found = false;
        for label in ["lyrics", "ambient"] {
            let Some(window) = app.get_webview_window(label) else {
                continue;
            };
            let Ok(handle) = window.hwnd() else {
                continue;
            };
            found = true;
            if !overlay::set_capture_hidden(handle.0 as isize, on) && on {
                return Err("Windows refused the request — capture exclusion needs Windows 10 2004 or newer".into());
            }
        }
        if found {
            Ok(())
        } else {
            Err("no Lyrica window is open yet".into())
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (app, on);
        Err("capture exclusion is only available on Windows".into())
    }
}

fn set_stream_safe(app: &AppHandle, on: bool) {
    let result = apply_stream_safe(app, on);

    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.stream_safe = on && result.is_ok();
        runtime.settings.save(&config_path(app));
        runtime.stream_safe_error = result.err();
    }

    sync_tray(app);
    emit_snapshot(app);
}

// --------------------------------------------------------------- tap to sync

/// Where the track is right now, using the same interpolation as the UI.
fn tap_position(playback: &Playback) -> i64 {
    let elapsed = if playback.status == "playing" {
        (now_ms() - playback.sampled_at_ms).max(0)
    } else {
        0
    };
    (playback.position_ms + elapsed).max(0)
}

fn begin_tap_sync(app: &AppHandle) -> Result<(), String> {
    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");

        if runtime.playback.status != "playing" {
            return Err("start playback first".into());
        }
        let lyrics = runtime
            .lyrics
            .as_ref()
            .ok_or("no lyrics are loaded for this track")?;
        let lines: Vec<String> = lyrics.lines.iter().map(|line| line.text.clone()).collect();
        if lines.is_empty() {
            return Err("this track has no lyric lines".into());
        }

        runtime.tap = Some(TapSession {
            key: runtime.track_key.clone(),
            lines,
            taps: Vec::new(),
            duration_ms: runtime.playback.duration_ms,
        });
    }

    emit_snapshot(app);
    Ok(())
}

/// Records the current position as the start of the next line. The last tap
/// saves automatically, so a full pass needs no extra keystroke.
fn record_tap(app: &AppHandle) -> Result<(), String> {
    let finished = {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");

        if runtime.playback.status != "playing" {
            return Err("playback is paused".into());
        }
        let position = tap_position(&runtime.playback);

        let session = runtime.tap.as_mut().ok_or("tap sync is not running")?;
        if session.taps.len() < session.lines.len() {
            session.taps.push(position);
        }
        session.taps.len() >= session.lines.len()
    };

    if finished {
        save_tap_sync(app)?;
    } else {
        emit_snapshot(app);
    }
    Ok(())
}

fn save_tap_sync(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<Shared>();
    let session = {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.tap.take()
    };
    let Some(session) = session else {
        return Err("tap sync is not running".into());
    };

    if session.taps.is_empty() {
        emit_snapshot(app);
        return Err("no taps were recorded".into());
    }

    let lrc = build_lrc(&session);
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("overrides");
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let file = dir.join(format!("{}.lrc", sanitize_key(&session.key)));
    std::fs::write(&file, lrc).map_err(|error| error.to_string())?;

    state.cache.set_override(&session.key, &file.to_string_lossy());
    state.cache.clear_negative(&session.key);
    state.cache.forget(&session.key);

    // Re-resolve the current track so the new timings load immediately.
    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        if runtime.track_key == session.key {
            runtime.track_key.clear();
            runtime.lyrics = None;
            runtime.loading = true;
        }
    }

    emit_snapshot(app);
    Ok(())
}

/// `[mm:ss.xx]line` for every line. Lines past the last tap are spread evenly
/// so the file always covers the whole lyric.
fn build_lrc(session: &TapSession) -> String {
    let mut out = String::new();
    let last = session.taps.last().copied().unwrap_or(0);

    for (index, line) in session.lines.iter().enumerate() {
        let mut start = match session.taps.get(index) {
            Some(time) => *time,
            None => {
                let step = (index + 1 - session.taps.len()) as i64;
                last + step * 4_000
            }
        };
        if session.duration_ms > 0 {
            start = start.min(session.duration_ms);
        }

        let minutes = start / 60_000;
        let seconds = (start % 60_000) as f64 / 1000.0;
        out.push_str(&format!("[{minutes:02}:{seconds:05.2}]{line}\n"));
    }

    out
}

fn sanitize_key(key: &str) -> String {
    let mut out: String = key
        .chars()
        .map(|ch| {
            if ch.is_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    while out.contains("--") {
        out = out.replace("--", "-");
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "track".into()
    } else {
        trimmed
    }
}

/// One press of the tap hotkey: start a run, or record the next line.
fn hotkey_tap(app: &AppHandle) {
    let active = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        runtime.tap.is_some()
    };

    let result = if active {
        record_tap(app)
    } else {
        begin_tap_sync(app)
    };

    if let Err(error) = result {
        eprintln!("tap sync: {error}");
        let _ = app.emit("lyrica:tap-sync", serde_json::json!({ "error": error }));
    }
}

fn shortcut_matches(
    shortcut: &tauri_plugin_global_shortcut::Shortcut,
    configured: &str,
) -> bool {
    configured
        .parse::<tauri_plugin_global_shortcut::Shortcut>()
        .map(|parsed| parsed == *shortcut)
        .unwrap_or(false)
}

fn sync_hotkeys(app: &AppHandle) {
    let (ambient, tap) = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        (
            runtime.settings.ambient_hotkey.clone(),
            runtime.settings.tap_sync_hotkey.clone(),
        )
    };

    let (capture, late) = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        (
            runtime.settings.stream_safe_hotkey.clone(),
            runtime.settings.late_night_hotkey.clone(),
        )
    };

    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();
    for combo in [ambient, tap, capture, late] {
        if let Err(error) = shortcuts.register(combo.as_str()) {
            eprintln!("global shortcut {combo}: {error}");
        }
    }
}

// ------------------------------------------------------------------ autostart + idle

#[cfg(windows)]
fn idle_seconds() -> u64 {
    overlay::idle_seconds()
}

#[cfg(not(windows))]
fn idle_seconds() -> u64 {
    0
}

pub fn handle_tray_event(app: &AppHandle, id: &str) {
    if let Some(style) = id.strip_prefix(tray::ITEM_STYLE_PREFIX) {
        set_style(app.clone(), style.to_string());
        return;
    }
    if let Some(value) = id.strip_prefix(tray::ITEM_SIZE_PREFIX) {
        if let Ok(percent) = value.parse::<f32>() {
            set_text_scale(app.clone(), percent / 100.0);
        }
        return;
    }
    if let Some(value) = id.strip_prefix(tray::ITEM_DISPLAY_PREFIX) {
        if let Ok(index) = value.parse::<usize>() {
            set_display(app.clone(), index);
        }
        return;
    }

    match id {
        tray::ITEM_OPEN => show_main_window(app),
        tray::ITEM_AWAKE => {
            let on = {
                let state = app.state::<Shared>();
                let runtime = state.runtime.lock().expect("runtime lock");
                runtime.settings.keep_awake
            };
            set_keep_awake(app.clone(), !on);
        }
        tray::ITEM_DESKTOP => {
            let on = {
                let state = app.state::<Shared>();
                let runtime = state.runtime.lock().expect("runtime lock");
                runtime.settings.show_on_desktop
            };
            set_show_on_desktop(app.clone(), !on);
        }
        tray::ITEM_LATE_NIGHT => {
            let on = {
                let state = app.state::<Shared>();
                let runtime = state.runtime.lock().expect("runtime lock");
                runtime.late_night
            };
            apply_late_night(app, !on);
        }
        tray::ITEM_LICENSE => open_license_window(app),
        tray::ITEM_QUIT => app.exit(0),
        _ => {}
    }
}

/// The short mid-song menu: what you actually reach for without leaving the
/// music. Everything else lives in the Window.
fn tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let (active, pinned, awake, desktop, scale, monitor, late_on) = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        (
            runtime.settings.style.clone(),
            runtime.settings.pinned_styles.clone(),
            runtime.settings.keep_awake,
            runtime.settings.show_on_desktop,
            runtime.settings.font_scale,
            runtime.settings.ambient_monitor,
            runtime.late_night,
        )
    };

    let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    items.push(Box::new(MenuItem::with_id(
        app,
        tray::ITEM_OPEN,
        "Open Lyrica",
        true,
        None::<&str>,
    )?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));

    if pinned.is_empty() {
        items.push(Box::new(MenuItem::with_id(
            app,
            "pinned-hint",
            "Pin styles in the window",
            false,
            None::<&str>,
        )?));
    } else {
        for id in &pinned {
            items.push(Box::new(CheckMenuItem::with_id(
                app,
                format!("{}{}", tray::ITEM_STYLE_PREFIX, id),
                style_label(id),
                true,
                *id == active,
                None::<&str>,
            )?));
        }
    }

    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(CheckMenuItem::with_id(
        app,
        tray::ITEM_AWAKE,
        "Keep Screen Awake",
        true,
        awake,
        None::<&str>,
    )?));
    items.push(Box::new(CheckMenuItem::with_id(
        app,
        tray::ITEM_DESKTOP,
        "Show on desktop",
        true,
        desktop,
        None::<&str>,
    )?));

    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    for percent in [75u32, 100, 125, 150] {
        items.push(Box::new(CheckMenuItem::with_id(
            app,
            format!("{}{}", tray::ITEM_SIZE_PREFIX, percent),
            format!("Text Size {percent}%"),
            true,
            (scale * 100.0).round() as u32 == percent,
            None::<&str>,
        )?));
    }

    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    let monitors = app.available_monitors().unwrap_or_default();
    for (index, display) in monitors.iter().enumerate() {
        let name = display
            .name()
            .cloned()
            .unwrap_or_else(|| format!("Display {}", index + 1));
        items.push(Box::new(CheckMenuItem::with_id(
            app,
            format!("{}{}", tray::ITEM_DISPLAY_PREFIX, index),
            name,
            true,
            index == monitor,
            None::<&str>,
        )?));
    }

    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(CheckMenuItem::with_id(
        app,
        tray::ITEM_LATE_NIGHT,
        "Late Night",
        true,
        late_on,
        None::<&str>,
    )?));
    items.push(Box::new(MenuItem::with_id(
        app,
        tray::ITEM_LICENSE,
        "License…",
        true,
        None::<&str>,
    )?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(MenuItem::with_id(
        app,
        tray::ITEM_QUIT,
        "Quit Lyrica",
        true,
        None::<&str>,
    )?));

    let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
        items.iter().map(|item| item.as_ref()).collect();
    Menu::with_items(app, &refs)
}

fn sync_tray(app: &AppHandle) {
    match tray_menu(app) {
        Ok(menu) => tray::sync_menu(app, menu),
        Err(error) => eprintln!("tray menu: {error}"),
    }
}

fn set_autostart(enabled: bool) {
    #[cfg(windows)]
    {
        if let Err(error) = autostart::set_enabled(enabled) {
            eprintln!("autostart: {error}");
        }
    }
    let _ = enabled;
}

// ------------------------------------------------------------------ commands

#[tauri::command]
fn get_state(state: State<Shared>) -> Snapshot {
    snapshot(&state)
}

#[tauri::command]
fn get_styles() -> Vec<&'static str> {
    STYLE_CATALOG.iter().map(|(id, _)| *id).collect()
}

#[tauri::command]
fn open_window(app: AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
fn pin_style(app: AppHandle, style: String, pinned: bool) {
    set_pinned(&app, style, pinned);
}

#[tauri::command]
fn set_style(app: AppHandle, style: String) {
    let state = app.state::<Shared>();
    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.style = style;
        runtime.settings.save(&config_path(&app));
    }
    emit_snapshot(&app);
}

#[tauri::command]
fn update_settings(app: AppHandle, patch: Settings) {
    let state = app.state::<Shared>();
    let want_stream_safe = patch.stream_safe;
    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        let mut next = patch;
        // Preferences sends a whole snapshot: keep the live window geometry
        // rather than the copy it loaded, and sanitize the free-text fields.
        next.window = runtime.settings.window.clone();
        next.cider_host = next.cider_host.trim().to_string();
        if next.cider_host.is_empty() {
            next.cider_host = "localhost".into();
        }
        next.cider_port = next.cider_port.clamp(1, 65_535);
        let ambient_master = next.ambient_enabled;
        let ambient_changed = ambient_master != runtime.settings.ambient_enabled;
        if ambient_changed {
            eprintln!(
                "settings: ambient {} -> {ambient_master} via update_settings",
                runtime.settings.ambient_enabled
            );
        }
        runtime.settings = next;
        runtime.settings.save(&config_path(&app));
        state.genius_parsing.store(
            runtime.settings.lyrics_allow_genius_page_parsing,
            Ordering::Relaxed,
        );
        state.pipeline.set_config(pipeline_config(&runtime.settings));
        if let Ok(mut cider) = state.cider.write() {
            cider.enabled = runtime.settings.cider_enabled;
            cider.host = runtime.settings.cider_host.clone();
            cider.port = runtime.settings.cider_port;
            cider.prefer_api = runtime.settings.cider_prefer_api;
        }
        drop(runtime);
        sync_hotkeys(&app);

        // "Ambient mode" is the master: switching it on shows the screen, and
        // switching it off takes it away and stops the idle timer opening it.
        if ambient_changed {
            set_ambient(&app, ambient_master);
        }
    }
    set_autostart(patch_autostart(&app));
    let wallpaper = patch_wallpaper(&app);
    apply_wallpaper_layer(&app, wallpaper);
    sync_tray(&app);
    set_stream_safe(&app, want_stream_safe);

    let (show_desktop, show_in_taskbar) = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        (
            runtime.settings.show_on_desktop,
            runtime.settings.show_in_taskbar,
        )
    };
    if show_desktop {
        show_lyrics_window(&app);
    } else if let Some(window) = app.get_webview_window("lyrics") {
        let _ = window.hide();
    }
    if let Some(window) = app.get_webview_window("window") {
        let _ = window.set_skip_taskbar(!show_in_taskbar);
    }
    emit_snapshot(&app);
}

/// Turns the stored preferences into pipeline behaviour.
fn pipeline_config(settings: &Settings) -> lyrics::PipelineConfig {
    let defaults = lyrics::PipelineConfig::default();
    lyrics::PipelineConfig {
        order: if settings.lyrics_provider_order.is_empty() {
            defaults.order
        } else {
            settings.lyrics_provider_order.clone()
        },
        // An empty enabled list means "nothing", not "everything".
        enabled: if settings.lyrics_providers_enabled.is_empty() {
            vec!["__none__".into()]
        } else {
            settings.lyrics_providers_enabled.clone()
        },
        confidence_threshold: settings.lyrics_confidence_threshold.clamp(0.0, 1.0),
        prefer_synced: settings.lyrics_prefer_synced,
        auto_estimate: settings.lyrics_auto_estimate,
        timeout_ms: defaults.timeout_ms,
        retries: defaults.retries,
    }
}

#[tauri::command]
fn test_lyrics_source(app: AppHandle, id: String) -> String {
    match id.as_str() {
        "cider" => {
            let shared = app.state::<Shared>().cider.clone();
            let config = shared.read().map(|c| c.clone()).unwrap_or_default();
            players::cider::test_connection(&config).message
        }
        "genius" => {
            if credentials::read(credentials::GENIUS_TOKEN).is_some() {
                "A Genius token is stored".into()
            } else {
                "No Genius token stored yet".into()
            }
        }
        "musixmatch" => {
            if credentials::read(credentials::MUSIXMATCH_KEY).is_some() {
                "A Musixmatch key is stored".into()
            } else {
                "No Musixmatch key stored yet".into()
            }
        }
        "lrclib" => "LRCLIB needs no key".into(),
        "local" => "Local cache and files need no key".into(),
        _ => "Unknown source".into(),
    }
}

fn patch_autostart(app: &AppHandle) -> bool {
    let state = app.state::<Shared>();
    let runtime = state.runtime.lock().expect("runtime lock");
    runtime.settings.autostart
}

fn patch_wallpaper(app: &AppHandle) -> bool {
    let state = app.state::<Shared>();
    let runtime = state.runtime.lock().expect("runtime lock");
    runtime.settings.wallpaper_layer
}

#[tauri::command]
fn nudge(app: AppHandle, delta_ms: i64) {
    let state = app.state::<Shared>();
    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.nudge_ms = (runtime.settings.nudge_ms + delta_ms).clamp(-5000, 5000);
        runtime.settings.save(&config_path(&app));
    }

    // Nudging a song is a statement about that song: keep it.
    let (playback, nudge_ms, remember) = {
        let runtime = state.runtime.lock().expect("runtime lock");
        (
            runtime.playback.clone(),
            runtime.settings.nudge_ms,
            runtime.settings.qol_enabled && runtime.settings.qol_song_memory,
        )
    };
    if remember && !playback.title.is_empty() {
        if let Ok(mut memory) = state.memory.lock() {
            memory.remember(&playback, "song", nudge_ms, None, now_ms());
            memory.save(&memory_path(&app));
        }
    }

    emit_snapshot(&app);
}

#[tauri::command]
fn remember_song(app: AppHandle, scope: String) -> Result<usize, String> {
    let state = app.state::<Shared>();
    let (playback, nudge_ms, style, enabled) = {
        let runtime = state.runtime.lock().expect("runtime lock");
        (
            runtime.playback.clone(),
            runtime.settings.nudge_ms,
            runtime.settings.style.clone(),
            runtime.settings.qol_enabled,
        )
    };

    if playback.title.is_empty() {
        return Err("nothing is playing".into());
    }
    if !enabled {
        return Err("turn on Quality of life first".into());
    }

    let mut memory = state.memory.lock().map_err(|_| "memory busy".to_string())?;
    memory.remember(&playback, &scope, nudge_ms, Some(&style), now_ms());
    memory.save(&memory_path(&app));
    let size = memory.entries.len();
    drop(memory);

    emit_snapshot(&app);
    Ok(size)
}

#[tauri::command]
fn forget_song(app: AppHandle) -> usize {
    let state = app.state::<Shared>();
    let playback = {
        let runtime = state.runtime.lock().expect("runtime lock");
        runtime.playback.clone()
    };

    let mut memory = state.memory.lock().expect("memory lock");
    let removed = memory.forget(&playback);
    memory.save(&memory_path(&app));
    drop(memory);

    emit_snapshot(&app);
    removed
}

/// Checks a rule against the desktop as it is right now, for the test button.
#[tauri::command]
fn qol_test_rule(rule: qol::Rule) -> bool {
    let env = qol::sample();
    qol::rule_matches(&rule, &env)
}

#[tauri::command]
fn qol_sample() -> qol::Env {
    qol::sample()
}

#[tauri::command]
fn sleep_timer(app: AppHandle, minutes: u32) {
    let state = app.state::<Shared>();
    let mut runtime = state.runtime.lock().expect("runtime lock");
    runtime.qol.sleep.until_ms = if minutes == 0 {
        0
    } else {
        now_ms() + minutes as i64 * 60_000
    };
    runtime.qol.sleep.fading = false;
    drop(runtime);
    emit_snapshot(&app);
}

#[tauri::command]
fn sleep_playlist_end(app: AppHandle, armed: bool) {
    let state = app.state::<Shared>();
    let mut runtime = state.runtime.lock().expect("runtime lock");
    runtime.qol.sleep.after_playlist = armed;
    runtime.qol.quiet_ticks = 0;
    drop(runtime);
    emit_snapshot(&app);
}

#[tauri::command]
fn set_light_override(app: AppHandle, mode: String) {
    let state = app.state::<Shared>();
    let mut runtime = state.runtime.lock().expect("runtime lock");
    runtime.qol.override_light = match mode.as_str() {
        "on" => Some(true),
        "off" => Some(false),
        _ => None,
    };
    runtime.qol.notice = None;
    let light = runtime.qol.override_light.unwrap_or(false);
    runtime.qol.light_mode = light;
    drop(runtime);
    emit_snapshot(&app);
}

/// The renderer reports its frame time; a run of slow frames switches Light
/// mode on and says why.
#[tauri::command]
fn report_frame_time(app: AppHandle, frame_ms: f32) {
    let state = app.state::<Shared>();
    let tripped = {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        if !runtime.settings.qol_enabled || runtime.settings.qol_light_mode != "auto" {
            return;
        }
        let tripped = runtime.qol.load.report(frame_ms);
        if tripped && !runtime.qol.light_mode && runtime.qol.override_light.is_none() {
            runtime.qol.light_mode = true;
            runtime.qol.notice = Some("Light mode · frame time over budget".into());
        }
        tripped
    };
    if tripped {
        emit_snapshot(&app);
    }
}

#[tauri::command]
fn toggle_play_pause() -> Result<(), String> {
    media::toggle_play_pause()
}

#[tauri::command]
fn set_ambient_mode(app: AppHandle, enabled: bool) {
    set_ambient(&app, enabled);
}

fn save_settings(app: &AppHandle, mutate: impl FnOnce(&mut Settings)) {
    let state = app.state::<Shared>();
    let mut runtime = state.runtime.lock().expect("runtime lock");
    let before = runtime.settings.ambient_enabled;
    mutate(&mut runtime.settings);
    if runtime.settings.ambient_enabled != before {
        eprintln!(
            "settings: ambient {before} -> {} in save_settings",
            runtime.settings.ambient_enabled
        );
    }
    runtime.settings.save(&config_path(app));
}

fn set_text_scale(app: AppHandle, scale: f32) {
    let clamped = scale.clamp(0.5, 2.0);
    save_settings(&app, |settings| settings.font_scale = clamped);
    emit_snapshot(&app);
    sync_tray(&app);
}

fn set_keep_awake(app: AppHandle, on: bool) {
    save_settings(&app, |settings| settings.keep_awake = on);
    emit_snapshot(&app);
    sync_tray(&app);
}

fn set_show_on_desktop(app: AppHandle, on: bool) {
    save_settings(&app, |settings| settings.show_on_desktop = on);
    if on {
        show_lyrics_window(&app);
    } else if let Some(window) = app.get_webview_window("lyrics") {
        let _ = window.hide();
    }
    emit_snapshot(&app);
    sync_tray(&app);
}

fn set_display(app: AppHandle, index: usize) {
    save_settings(&app, |settings| {
        settings.ambient_monitor = index;
        settings.late_night_monitor = index;
    });
    place_ambient(&app, index);
    let late_on = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        runtime.late_night
    };
    if late_on {
        sync_late_night_windows(&app);
    }
    emit_snapshot(&app);
    sync_tray(&app);
}

fn set_pinned(app: &AppHandle, style: String, pinned: bool) {
    save_settings(app, |settings| {
        settings.pinned_styles.retain(|id| *id != style);
        if pinned {
            settings.pinned_styles.push(style.clone());
        }
        while settings.pinned_styles.len() > 5 {
            settings.pinned_styles.remove(0);
        }
    });
    emit_snapshot(app);
    sync_tray(app);
}

#[tauri::command]
fn spotify_status(app: AppHandle) -> accounts::spotify::SpotifyStatus {
    let mut status = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        accounts::spotify::status(&runtime.settings)
    };

    if let Ok(spotify) = app.state::<Shared>().spotify.lock() {
        if let Some(error) = spotify.error.clone() {
            status.error = Some(error);
        }
    }
    status
}

/// Starts the browser login on a worker thread; the answer arrives as a
/// `lyrica:spotify` event so the UI never blocks on the redirect.
#[tauri::command]
fn spotify_link(app: AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        let request = {
            let state = handle.state::<Shared>();
            let runtime = state.runtime.lock().expect("runtime lock");
            accounts::spotify::LinkRequest {
                client_id: runtime.settings.spotify_client_id.clone(),
                port: runtime.settings.spotify_redirect_port.max(1024),
                controls: runtime.settings.spotify_controls,
            }
        };

        match accounts::spotify::link(&request) {
            Ok(linked) => {
                let expires_at = accounts::spotify::store_tokens(&linked.tokens).unwrap_or(0);
                let profile = accounts::spotify::fetch_profile(&linked.tokens.access).ok();

                {
                    let state = handle.state::<Shared>();
                    let mut runtime = state.runtime.lock().expect("runtime lock");
                    runtime.settings.spotify_expires_at_ms = expires_at;
                    if let Some((name, product)) = profile {
                        runtime.settings.spotify_account = name;
                        runtime.settings.spotify_product = product;
                    }
                    runtime.settings.save(&config_path(&handle));
                }

                emit_snapshot(&handle);
                let _ = handle.emit("lyrica:spotify", serde_json::json!({ "linked": true }));
            }
            Err(error) => {
                if let Ok(mut spotify) = handle.state::<Shared>().spotify.lock() {
                    spotify.error = Some(error.clone());
                }
                let _ = handle.emit("lyrica:spotify", serde_json::json!({ "error": error }));
            }
        }
    });
}

#[tauri::command]
fn spotify_unlink(app: AppHandle) -> accounts::spotify::SpotifyStatus {
    accounts::spotify::forget_tokens();

    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.spotify_account.clear();
        runtime.settings.spotify_product.clear();
        runtime.settings.spotify_expires_at_ms = 0;
        runtime.settings.save(&config_path(&app));
    }
    if let Ok(mut spotify) = app.state::<Shared>().spotify.lock() {
        *spotify = SpotifyState::default();
    }

    emit_snapshot(&app);
    spotify_status(app)
}

#[tauri::command]
fn spotify_control(
    app: AppHandle,
    action: String,
    value: Option<String>,
) -> Result<(), String> {
    let settings = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.clone()
    };

    let token = accounts::spotify::access_token(&settings)?;
    accounts::spotify::control(&token, &action, value.as_deref()).map_err(|error| error.message())
}

/// Polls the linked account: about once a second while something plays, and
/// much slower when it is paused, idle or backing off after a 429.
fn start_spotify_poller(app: AppHandle) {
    std::thread::spawn(move || loop {
        let (linked, settings) = {
            let state = app.state::<Shared>();
            let runtime = state.runtime.lock().expect("runtime lock");
            (
                credentials::read(credentials::SPOTIFY_REFRESH).is_some(),
                runtime.settings.clone(),
            )
        };

        if !linked {
            std::thread::sleep(Duration::from_secs(5));
            continue;
        }

        let token = match accounts::spotify::access_token(&settings) {
            Ok(token) => token,
            Err(error) => {
                if let Ok(mut spotify) = app.state::<Shared>().spotify.lock() {
                    spotify.error = Some(error);
                    spotify.sample = None;
                }
                std::thread::sleep(Duration::from_secs(15));
                continue;
            }
        };

        let wait = match accounts::spotify::fetch_now_playing(&token) {
            Ok(sample) => {
                let playing = sample.as_ref().map(|entry| entry.playing).unwrap_or(false);
                if let Ok(mut spotify) = app.state::<Shared>().spotify.lock() {
                    spotify.error = None;
                    spotify.device = sample.as_ref().and_then(|entry| entry.device.clone());
                    spotify.sample = sample;
                }
                if playing {
                    Duration::from_millis(1_000)
                } else {
                    Duration::from_secs(4)
                }
            }
            Err(accounts::spotify::ApiError::RateLimited(seconds)) => {
                if let Ok(mut spotify) = app.state::<Shared>().spotify.lock() {
                    spotify.error = Some(accounts::spotify::ApiError::RateLimited(seconds).message());
                }
                Duration::from_secs(seconds)
            }
            Err(accounts::spotify::ApiError::Unauthorized) => {
                let _ = credentials::delete(credentials::SPOTIFY_ACCESS);
                if let Ok(mut spotify) = app.state::<Shared>().spotify.lock() {
                    spotify.sample = None;
                    spotify.error = Some(
                        "Spotify rejected the saved session; link the account again".into(),
                    );
                }
                Duration::from_secs(20)
            }
            Err(error) => {
                if let Ok(mut spotify) = app.state::<Shared>().spotify.lock() {
                    spotify.error = Some(error.message());
                }
                Duration::from_secs(6)
            }
        };

        std::thread::sleep(wait);
    });
}

fn open_license_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("license") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(app, "license", tauri::WebviewUrl::App("index.html".into()))
        .title("Lyrica License")
        .inner_size(560.0, 480.0)
        .min_inner_size(460.0, 380.0)
        .center()
        .resizable(true)
        .build();
}

#[tauri::command]
fn license_status(app: AppHandle) -> license::LicenseStatus {
    let state = app.state::<Shared>();
    let runtime = state.runtime.lock().expect("runtime lock");
    license::status(&runtime.settings)
}

#[tauri::command]
fn activate_license(app: AppHandle, key: String) -> Result<license::LicenseStatus, String> {
    license::verify(&key).map_err(|error| error.message())?;
    credentials::write(credentials::LICENSE_KEY, key.trim())?;
    let status = license_status(app.clone());
    emit_snapshot(&app);
    Ok(status)
}

#[tauri::command]
fn deactivate_license(app: AppHandle) -> Result<license::LicenseStatus, String> {
    let _ = credentials::delete(credentials::LICENSE_KEY);
    let status = license_status(app.clone());
    emit_snapshot(&app);
    Ok(status)
}

#[tauri::command]
fn open_license(app: AppHandle) {
    open_license_window(&app);
}

#[tauri::command]
fn set_late_night(app: AppHandle, enabled: bool) {
    apply_late_night(&app, enabled);
}

#[tauri::command]
fn set_wallpaper_layer(app: AppHandle, enabled: bool) {
    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.wallpaper_layer = enabled;
        runtime.settings.save(&config_path(&app));
    }
    apply_wallpaper_layer(&app, enabled);
    sync_tray(&app);
    emit_snapshot(&app);
}

#[tauri::command]
fn reload_lyrics(app: AppHandle) {
    let state = app.state::<Shared>();
    state.cache.clear();
    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.track_key.clear();
        runtime.lyrics = None;
    }
    emit_snapshot(&app);
}

#[tauri::command]
fn tap_sync_start(app: AppHandle) -> Result<(), String> {
    begin_tap_sync(&app)
}

#[tauri::command]
fn tap_sync_record(app: AppHandle) -> Result<(), String> {
    record_tap(&app)
}

#[tauri::command]
fn tap_sync_save(app: AppHandle) -> Result<(), String> {
    save_tap_sync(&app)
}

#[tauri::command]
fn tap_sync_cancel(app: AppHandle) {
    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.tap = None;
    }
    emit_snapshot(&app);
}

#[tauri::command]
fn test_cider(app: AppHandle) -> players::cider::CiderStatus {
    let shared = app.state::<Shared>().cider.clone();
    let config = shared
        .read()
        .map(|config| config.clone())
        .unwrap_or_default();
    players::cider::test_connection(&config)
}

#[tauri::command]
fn set_cider_token(app: AppHandle, token: String) -> Result<(), String> {
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        let _ = credentials::delete(credentials::CIDER_TOKEN);
    } else {
        credentials::write(credentials::CIDER_TOKEN, &trimmed)?;
    }

    let state = app.state::<Shared>();
    let mut config = state.cider.write().map_err(|_| "cider config".to_string())?;
    config.token = (!trimmed.is_empty()).then_some(trimmed);
    Ok(())
}

#[tauri::command]
fn open_preferences(app: AppHandle) {
    show_prefs(&app);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ------------------------------------------------------------------ bootstrap

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_lyrics_window(app);
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        return;
                    }
                    let Some(state) = app.try_state::<Shared>() else {
                        return;
                    };
                    let (ambient, tap, capture, late) = {
                        let runtime = state.runtime.lock().expect("runtime lock");
                        (
                            runtime.settings.ambient_hotkey.clone(),
                            runtime.settings.tap_sync_hotkey.clone(),
                            runtime.settings.stream_safe_hotkey.clone(),
                            runtime.settings.late_night_hotkey.clone(),
                        )
                    };

                    if shortcut_matches(shortcut, &tap) {
                        hotkey_tap(app);
                    } else if shortcut_matches(shortcut, &late) {
                        let on = {
                            let runtime = state.runtime.lock().expect("runtime lock");
                            runtime.late_night
                        };
                        apply_late_night(app, !on);
                    } else if shortcut_matches(shortcut, &capture) {
                        let on = {
                            let runtime = state.runtime.lock().expect("runtime lock");
                            runtime.settings.stream_safe
                        };
                        set_stream_safe(app, !on);
                    } else if shortcut_matches(shortcut, &ambient) {
                        let visible = app
                            .get_webview_window("ambient")
                            .map(|w| w.is_visible().unwrap_or(false))
                            .unwrap_or(false);
                        // A peek: show or hide the screen for now, but leave the
                        // master switch alone, so dismissing it does not turn the
                        // mode (and the idle timer) off for good.
                        set_ambient(app, !visible);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();

            let settings = Settings::load(&config_path(&handle));
            let cache = Arc::new(
                lyrics::cache::Cache::open(&db_path(&handle)).expect("lyrics cache"),
            );
            let genius_parsing = Arc::new(AtomicBool::new(
                settings.lyrics_allow_genius_page_parsing,
            ));
            let cider = Arc::new(RwLock::new(players::cider::CiderConfig {
                enabled: settings.cider_enabled,
                host: settings.cider_host.clone(),
                port: settings.cider_port,
                prefer_api: settings.cider_prefer_api,
                token: credentials::read(credentials::CIDER_TOKEN),
            }));
            let providers: Vec<Arc<dyn lyrics::LyricsProvider>> = vec![
                Arc::new(lyrics::cider::CiderLyricsProvider::new(cider.clone())),
                Arc::new(lyrics::local::LocalProvider::new(cache.clone())),
                Arc::new(lyrics::lrclib::LrclibProvider::new()),
                Arc::new(lyrics::musixmatch::MusixmatchProvider::new(
                    credentials::read(credentials::MUSIXMATCH_KEY),
                )),
                Arc::new(lyrics::genius::GeniusProvider::new(
                    credentials::read(credentials::GENIUS_TOKEN),
                    genius_parsing.clone(),
                )),
            ];
            let pipeline = Arc::new(lyrics::Pipeline::new(
                providers,
                cache.clone(),
                pipeline_config(&settings),
            ));
            let initial_playback = media::snapshot();
            let saved_window = settings.window.clone();

            let accent_hotkey = settings.ambient_hotkey.clone();
            let tap_hotkey = settings.tap_sync_hotkey.clone();
            let capture_hotkey = settings.stream_safe_hotkey.clone();
            let capture_on = settings.stream_safe;
            let late_hotkey = settings.late_night_hotkey.clone();
            let autostart_on = settings.autostart;
            let wallpaper_on = settings.wallpaper_layer;
            let ambient_on = settings.ambient_enabled;

            app.manage(Shared {
                runtime: Mutex::new(Runtime {
                    settings,
                    playback: initial_playback,
                    lyrics: None,
                    track_key: String::new(),
                    loading: false,
                    ambient_on: false,
                    ambient_auto: false,
                    ambient_opened_ms: 0,
                    overlay_hidden: false,
                    error: None,
                    stream_safe_error: None,
                    late_night: false,
                    tap: None,
                    qol: QolRuntime::default(),
                }),
                cache,
                pipeline,
                genius_parsing,
                cider,
                spotify: Arc::new(Mutex::new(SpotifyState::default())),
                memory: Arc::new(Mutex::new(qol::SongMemory::load(&memory_path(app.handle())))),
            });

            let initial_menu = tray_menu(&handle)?;
            tray::build(&handle, initial_menu)?;

            // Remember the window's size and place on this monitor.
            if let Some(window) = app.get_webview_window("lyrics") {
                if saved_window.width >= 200 && saved_window.height >= 120 {
                    let _ = window.set_position(PhysicalPosition::new(saved_window.x, saved_window.y));
                    let _ = window.set_size(PhysicalSize::new(saved_window.width, saved_window.height));
                }
            }

            if let Err(error) = app.global_shortcut().register(accent_hotkey.as_str()) {
                eprintln!("global shortcut: {error}");
            }
            if let Err(error) = app.global_shortcut().register(tap_hotkey.as_str()) {
                eprintln!("tap sync shortcut: {error}");
            }
            if let Err(error) = app.global_shortcut().register(capture_hotkey.as_str()) {
                eprintln!("capture shortcut: {error}");
            }
            if let Err(error) = app.global_shortcut().register(late_hotkey.as_str()) {
                eprintln!("late night shortcut: {error}");
            }

            if capture_on {
                if let Err(error) = apply_stream_safe(&handle, true) {
                    eprintln!("capture exclusion: {error}");
                    let state = handle.state::<Shared>();
                    let mut runtime = state.runtime.lock().expect("runtime lock");
                    runtime.settings.stream_safe = false;
                    runtime.stream_safe_error = Some(error);
                }
                sync_tray(&handle);
            }

            if wallpaper_on {
                let _ = ensure_ambient_window(&handle, 0);
                apply_wallpaper_layer(&handle, true);
            }
            // Ambient mode is a mode: if it was left on, come back in it.
            if ambient_on {
                let handle = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(900));
                    set_ambient(&handle, true);
                });
            }

            // The first launch stamps the trial and opens the window, which is
            // also the onboarding.
            let needs_trial_stamp = {
                let state = handle.state::<Shared>();
                let runtime = state.runtime.lock().expect("runtime lock");
                runtime.settings.trial_started_ms == 0
            };
            if needs_trial_stamp {
                {
                    let state = handle.state::<Shared>();
                    let mut runtime = state.runtime.lock().expect("runtime lock");
                    runtime.settings.trial_started_ms = license::now_ms();
                    runtime.settings.save(&config_path(&handle));
                }
                show_main_window(&handle);
            }

            start_poller(handle.clone());
            start_spotify_poller(handle.clone());
            set_autostart(autostart_on);
            start_ambient_loop(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "window" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
                return;
            }
            if window.label() != "lyrics" {
                return;
            }
            match event {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                    let app = window.app_handle();
                    let state = app.state::<Shared>();
                    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else {
                        return;
                    };
                    let path = config_path(app);
                    let mut runtime = state.runtime.lock().expect("runtime lock");
                    runtime.settings.window = WindowState {
                        x: position.x,
                        y: position.y,
                        width: size.width,
                        height: size.height,
                        monitor: String::new(),
                    };

                    let now = now_ms();
                    if now - LAST_GEOMETRY_SAVE.load(Ordering::Relaxed) > 400 {
                        LAST_GEOMETRY_SAVE.store(now, Ordering::Relaxed);
                        runtime.settings.save(&path);
                    }
                }
                WindowEvent::CloseRequested { api, .. } => {
                    // Tray app: closing the window hides it instead of quitting.
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            get_styles,
            set_style,
            update_settings,
            nudge,
            toggle_play_pause,
            set_ambient_mode,
            set_late_night,
            set_wallpaper_layer,
            reload_lyrics,
            test_lyrics_source,
            tap_sync_start,
            tap_sync_record,
            tap_sync_save,
            tap_sync_cancel,
            test_cider,
            set_cider_token,
            open_preferences,
            open_window,
            pin_style,
            spotify_status,
            spotify_link,
            spotify_unlink,
            spotify_control,
            remember_song,
            forget_song,
            qol_test_rule,
            qol_sample,
            sleep_timer,
            sleep_playlist_end,
            set_light_override,
            report_frame_time,
            license_status,
            activate_license,
            deactivate_license,
            open_license,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lyrica");
}

fn start_poller(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(POLL_MS));

        let playback = {
            // A linked account sees every device on the account, and its position
            // is exact, so it wins while the sample is fresh. SMTC stays the
            // fallback the moment the API goes quiet.
            let linked = app
                .state::<Shared>()
                .spotify
                .lock()
                .ok()
                .and_then(|state| state.sample.clone())
                .filter(|sample| now_ms() - sample.sampled_at_ms < 4_000)
                .map(|sample| accounts::spotify::to_local_playback(&sample));

            if let Some(playback) = linked {
                playback
            } else {
            let shared_cider = app.state::<Shared>().cider.clone();
            let cider = shared_cider
                .read()
                .map(|config| config.clone())
                .unwrap_or_default();

            let smtc = media::snapshot();
            let smtc_is_cider = smtc.app.eq_ignore_ascii_case("cider");

            // Cider's API gives exact position; SMTC covers no-token setups.
            if cider.enabled {
                match players::cider::now_playing(&cider) {
                    Some(snapshot)
                        if smtc_is_cider || (cider.prefer_api && snapshot.status == "playing") =>
                    {
                        snapshot
                    }
                    _ => smtc,
                }
            } else {
                smtc
            }
            }
        };
        let mut request: Option<(String, TrackQuery)> = None;

        {
            let state = app.state::<Shared>();
            let mut runtime = state.runtime.lock().expect("runtime lock");

            let key = if playback.is_active() { playback.key() } else { String::new() };
            // A backwards jump inside the same track means the song restarted.
            if !key.is_empty() && key == runtime.track_key {
                let previous = runtime.playback.position_ms;
                if previous > 5_000 && playback.position_ms + 4_000 < previous {
                    runtime.qol.repeated = runtime.qol.repeated.saturating_add(1);
                }
            }
            if key != runtime.track_key {
                runtime.qol.repeated = 0;
                // Per-song memory: this track's nudge and style (or its album's,
                // or its artist's) come back by themselves.
                if !key.is_empty() && runtime.settings.qol_enabled && runtime.settings.qol_song_memory {
                    if let Some(entry) = state.memory.lock().ok().and_then(|memory| memory.resolve(&playback)) {
                        runtime.settings.nudge_ms = entry.nudge_ms;
                        if let Some(style) = entry.style {
                            runtime.settings.style = style;
                        }
                    }
                }
                runtime.track_key = key.clone();
                runtime.lyrics = None;
                runtime.error = None;
                runtime.loading = !key.is_empty();
                if !key.is_empty() {
                    request = Some((
                        key,
                        TrackQuery {
                            title: playback.title.clone(),
                            artist: playback.artist.clone(),
                            album: playback.album.clone(),
                            duration_ms: playback.duration_ms,
                        },
                    ));
                }
            }

            runtime.playback = playback;
        }

        if let Some((key, query)) = request {
            spawn_lyric_lookup(app.clone(), key, query);
            emit_snapshot(&app);
        }

        let _ = app.emit("lyrica:tick", now_ms());
    });
}

// ------------------------------------------------------------------ windows

pub fn show_main_window(app: &AppHandle) {
    let Some(window) = ensure_main_window(app) else {
        return;
    };
    let show_in_taskbar = {
        let state = app.state::<Shared>();
        let runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings.show_in_taskbar
    };
    let _ = window.set_skip_taskbar(!show_in_taskbar);
    let _ = window.show();
    let _ = window.set_focus();
}

fn ensure_main_window(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(window) = app.get_webview_window("window") {
        return Some(window);
    }

    WebviewWindowBuilder::new(app, "window", tauri::WebviewUrl::App("index.html".into()))
        .title("Lyrica")
        .inner_size(1060.0, 760.0)
        .min_inner_size(860.0, 600.0)
        .center()
        .build()
        .ok()
}

/// Style ids and the names the tray shows. The gallery lives in the frontend;
/// this list only has to agree with it.
const STYLE_CATALOG: &[(&str, &str)] = &[
    ("ship", "Ship"),
    ("fisheye", "Fisheye"),
    ("visual", "Visual"),
    ("fisheye-visual", "Fisheye Visual"),
    ("codestyle", "Codestyle"),
    ("codestyle-visual", "Codestyle Visual"),
    ("branches", "Branches"),
    ("web", "Web"),
    ("constellation", "Constellation"),
    ("messages", "Native Design"),
    ("money", "Native Design Money"),
    ("map", "Native Design Map"),
    ("notifications", "Native Design Notifications"),
];

fn style_label(id: &str) -> String {
    STYLE_CATALOG
        .iter()
        .find(|(style_id, _)| *style_id == id)
        .map(|(_, name)| (*name).to_string())
        .unwrap_or_else(|| id.to_string())
}

/// Reads the Windows light/dark choice; the app UI follows it when asked to.
fn windows_light_theme() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize")
            .and_then(|key| key.get_value::<u32, _>("AppsUseLightTheme"))
            .map(|value| value == 1)
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// One evaluation of the rules and the timers. Runs on the ambient ticker, so
/// nothing here starts a thread or wakes the GPU.
fn qol_tick(app: &AppHandle) {
    let state = app.state::<Shared>();
    let (
        enabled,
        rules,
        allow,
        deny,
        sleep_minutes,
        light_setting,
        theme_follow,
        user_stream_safe,
        playing,
    ) = {
        let runtime = state.runtime.lock().expect("runtime lock");
        let settings = &runtime.settings;
        (
            settings.qol_enabled,
            settings.qol_rules.clone(),
            settings.qol_allowlist.clone(),
            settings.qol_denylist.clone(),
            settings.qol_sleep_minutes,
            settings.qol_light_mode.clone(),
            settings.qol_theme_follow,
            settings.stream_safe,
            runtime.playback.status == "playing",
        )
    };

    if !enabled {
        let restore = {
            let mut runtime = state.runtime.lock().expect("runtime lock");
            let was_overridden = runtime.qol.capture_override;
            runtime.qol.actions.clear();
            runtime.qol.light_mode = false;
            runtime.qol.capture_override = false;
            runtime.qol.sleep = qol::SleepState::default();
            was_overridden
        };
        if restore {
            let _ = apply_stream_safe(app, user_stream_safe);
        }
        return;
    }

    let env = qol::sample();
    let mut actions = qol::active_actions(&rules, &env);
    if qol::should_hide_over(&env, &allow, &deny) && !actions.iter().any(|a| a == "hideOverlays") {
        actions.push("hideOverlays".into());
    }

    let auto_light = light_setting == "on"
        || (light_setting == "auto"
            && (env.battery_saver
                || actions.iter().any(|action| action == "lightMode")
                || state
                    .runtime
                    .lock()
                    .map(|runtime| runtime.qol.load.tripped)
                    .unwrap_or(false)));

    let now = now_ms();
    let mut capture_desired: Option<bool> = None;
    let mut pause_ambient = false;
    let mut fade_now = false;
    let mut changed = false;

    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.qol.env = env.clone();
        runtime.qol.actions = actions.clone();

        if sleep_minutes == 0 {
            runtime.qol.sleep.until_ms = 0;
        } else if runtime.qol.sleep.until_ms == 0 {
            runtime.qol.sleep.until_ms = now + sleep_minutes as i64 * 60_000;
        }

        if playing {
            runtime.qol.quiet_ticks = 0;
        } else if runtime.qol.was_playing && runtime.qol.sleep.after_playlist {
            runtime.qol.quiet_ticks = runtime.qol.quiet_ticks.saturating_add(1);
        }
        runtime.qol.was_playing = playing;

        let deadline = qol::sleep_reached(&runtime.qol.sleep, now);
        let playlist_done = runtime.qol.sleep.after_playlist && runtime.qol.quiet_ticks >= 2;
        if deadline || playlist_done {
            // One shot: the timer and the queue rule both clear themselves.
            runtime.qol.sleep.fading = true;
            runtime.qol.sleep.after_playlist = false;
            runtime.settings.qol_sleep_minutes = 0;
            runtime.settings.save(&config_path(app));
            fade_now = true;
        }

        let light = runtime.qol.override_light.unwrap_or(auto_light);
        if light && !runtime.qol.light_mode && runtime.qol.override_light.is_none() {
            runtime.qol.notice = Some(if env.battery_saver {
                "Light mode · battery saver".into()
            } else {
                "Light mode · this machine is busy".into()
            });
        } else if !light {
            runtime.qol.notice = None;
        }
        runtime.qol.light_mode = light;

        let want_capture = actions.iter().any(|action| action == "streamingMode");
        if want_capture != runtime.qol.capture_override {
            runtime.qol.capture_override = want_capture;
            capture_desired = Some(want_capture || user_stream_safe);
        }

        pause_ambient = actions.iter().any(|action| action == "pauseAmbient");

        let signature = format!(
            "{:?}|{light}|{}|{}|{}|{}|{}|{}",
            actions,
            env.fullscreen,
            env.process,
            runtime.qol.sleep.until_ms,
            runtime.qol.repeated,
            theme_follow && windows_light_theme(),
            runtime.qol.notice.clone().unwrap_or_default(),
        );
        changed = signature != runtime.qol.signature;
        runtime.qol.signature = signature;
    }

    if let Some(hidden) = capture_desired {
        let _ = apply_stream_safe(app, hidden);
    }

    if pause_ambient {
        let visible = ambient_window(app)
            .map(|window| window.is_visible().unwrap_or(false))
            .unwrap_or(false);
        if visible {
            eprintln!("ambient: closed by a call rule ({})", env.process);
            set_ambient(app, false);
        }
    }

    if fade_now {
        let _ = app.emit("lyrica:ambient-sleep", 1_400u64);
        std::thread::sleep(Duration::from_millis(1_400));
        // Going to sleep means the screen goes dark, so the overlay must not
        // pop back up behind the ambient screen as it closes.
        {
            let mut runtime = state.runtime.lock().expect("runtime lock");
            runtime.overlay_hidden = false;
        }
        set_ambient(app, false);
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.qol.sleep = qol::SleepState::default();
        runtime.qol.quiet_ticks = 0;
        drop(runtime);
        changed = true;
    }

    if changed {
        emit_snapshot(app);
    }
}

fn start_ambient_loop(app: AppHandle) {
    std::thread::spawn(move || {
        let mut tick: u64 = 0;
        let mut was_playing = false;
        let mut resume_pending = false;

        loop {
            std::thread::sleep(Duration::from_millis(1_000));
            tick += 1;

            let state = app.state::<Shared>();
            let (
                ambient_enabled,
                ambient_auto,
                ambient_opened_ms,
                idle_limit,
                hide_over_fullscreen,
                late_idle_minutes,
                late_on_play,
                late_hide_fullscreen,
                late_resume,
                late_keep_awake,
                keep_awake,
            ) = {
                let runtime = state.runtime.lock().expect("runtime lock");
                let settings = &runtime.settings;
                let runtime_ambient_auto = runtime.ambient_auto;
                let runtime_ambient_opened = runtime.ambient_opened_ms;
                (
                    settings.ambient_enabled,
                    runtime_ambient_auto,
                    runtime_ambient_opened,
                    settings.ambient_idle_minutes * 60,
                    settings.hide_over_fullscreen,
                    settings.late_night_idle_minutes,
                    settings.late_night_on_play,
                    settings.late_night_hide_fullscreen,
                    settings.late_night_resume_after_unlock,
                    settings.late_night_keep_awake,
                    settings.keep_awake,
                )
            };

            if tick % 2 != 0 {
                continue;
            }

            let idle = idle_seconds();
            let (mut late_on, playing) = {
                let runtime = state.runtime.lock().expect("runtime lock");
                (runtime.late_night, runtime.playback.status == "playing")
            };
            let visible = ambient_window(&app)
                .map(|w| w.is_visible().unwrap_or(false))
                .unwrap_or(false);

            #[cfg(windows)]
            overlay::keep_display_awake((late_on && late_keep_awake) || (keep_awake && playing));

            if late_on {
                sync_late_night_windows(&app);
            }

            if !late_on {
                if late_idle_minutes > 0 && playing && idle >= late_idle_minutes as u64 * 60 {
                    apply_late_night(&app, true);
                    late_on = true;
                } else if late_on_play && playing && !was_playing {
                    apply_late_night(&app, true);
                    late_on = true;
                }
            }
            was_playing = playing;

            #[cfg(windows)]
            {
                let locked = overlay::session_locked();
                if locked && late_on {
                    apply_late_night(&app, false);
                    late_on = false;
                    resume_pending = late_resume;
                } else if !locked && resume_pending {
                    resume_pending = false;
                    apply_late_night(&app, true);
                    late_on = true;
                }

                if late_on && late_hide_fullscreen && overlay::exclusive_fullscreen_active() {
                    apply_late_night(&app, false);
                    late_on = false;
                }
            }

            if !late_on {
                if !ambient_enabled && visible {
                    eprintln!("ambient: closed because the master switch is off");
                    set_ambient(&app, false);
                } else if ambient_enabled && idle_limit > 0 && idle >= idle_limit as u64 && !visible {
                    set_ambient_with(&app, true, true);
                } else if visible
                    && ambient_auto
                    && idle < 3
                    && now_ms() - ambient_opened_ms > 5_000
                {
                    eprintln!("ambient: closed by activity after the idle timer opened it");
                    set_ambient(&app, false);
                }
            }

            #[cfg(windows)]
            if visible && hide_over_fullscreen && overlay::exclusive_fullscreen_active() {
                eprintln!("ambient: closed as an exclusive-fullscreen app took the display");
                set_ambient(&app, false);
            }

            qol_tick(&app);
        }
    });
}

#[cfg(test)]
mod tap_tests {
    use super::*;

    fn session(lines: &[&str], taps: &[i64], duration_ms: i64) -> TapSession {
        TapSession {
            key: "spotify::invented::200".into(),
            lines: lines.iter().map(|line| line.to_string()).collect(),
            taps: taps.to_vec(),
            duration_ms,
        }
    }

    #[test]
    fn lrc_uses_the_recorded_times() {
        let lrc = build_lrc(&session(&["invented one", "invented two"], &[4_200, 9_800], 200_000));
        assert_eq!(lrc, "[00:04.20]invented one\n[00:09.80]invented two\n");
    }

    #[test]
    fn untapped_lines_follow_the_last_tap() {
        let lrc = build_lrc(&session(&["one", "two", "three"], &[5_000], 200_000));
        let lines: Vec<&str> = lrc.lines().collect();
        assert_eq!(lines.len(), 3);
        assert!(lines[1].starts_with("[00:09.00]"), "{}", lines[1]);
        assert!(lines[2].starts_with("[00:13.00]"), "{}", lines[2]);
    }

    #[test]
    fn times_never_exceed_the_track() {
        let lrc = build_lrc(&session(&["one", "two"], &[199_000], 200_000));
        let last = lrc.lines().last().unwrap_or_default();
        assert!(last.starts_with("[03:20.00]"), "{last}");
    }

    #[test]
    fn keys_become_safe_file_names() {
        assert_eq!(
            sanitize_key("spotify|cider::joji::slow dancing"),
            "spotify-cider-joji-slow-dancing"
        );
        assert_eq!(sanitize_key("::"), "track");
    }
}
