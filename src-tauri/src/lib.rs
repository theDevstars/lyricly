mod credentials;
mod lyrics;
mod media;
mod overlay;
mod settings;
mod tray;

#[cfg(windows)]
mod autostart;

use lyrics::{Lyrics, TrackQuery};
use media::{now_ms, Playback};
use settings::{Settings, WindowState};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Window geometry is written to disk at most this often while dragging.
static LAST_GEOMETRY_SAVE: AtomicI64 = AtomicI64::new(0);

const POLL_MS: u64 = 250;

pub struct Runtime {
    pub settings: Settings,
    pub playback: Playback,
    pub lyrics: Option<Lyrics>,
    pub track_key: String,
    pub loading: bool,
    pub ambient_on: bool,
    pub error: Option<String>,
}

pub struct Shared {
    pub runtime: Mutex<Runtime>,
    pub cache: Arc<lyrics::cache::Cache>,
    pub pipeline: Arc<lyrics::Pipeline>,
    /// Live switch for Genius page parsing, so the preference applies without a restart.
    pub genius_parsing: Arc<AtomicBool>,
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
    }
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

fn show_prefs(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("prefs") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let window = WebviewWindowBuilder::new(app, "prefs", tauri::WebviewUrl::App("index.html".into()))
        .title("Lyrica Preferences")
        .inner_size(860.0, 660.0)
        .min_inner_size(720.0, 520.0)
        .resizable(true)
        .decorations(true)
        .transparent(false)
        .center()
        .build();

    match window {
        Ok(window) => {
            let _ = window.set_focus();
        }
        Err(error) => eprintln!("could not open preferences: {error}"),
    }
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

    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let position = monitor.position().to_logical::<f64>(scale);

    let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
    let _ = window.set_size(PhysicalSize::new(size.width, size.height));
}

fn set_ambient(app: &AppHandle, on: bool) {
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
    } else if let Some(window) = ambient_window(app) {
        let _ = window.hide();
    }

    {
        let state = app.state::<Shared>();
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.ambient_on = on;
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
    match id {
        tray::ITEM_SHOW => {
            show_lyrics_window(app);
        }
        tray::ITEM_PREFS => show_prefs(app),
        tray::ITEM_AMBIENT => {
            let on = !ambient_window(app).map(|w| w.is_visible().unwrap_or(false)).unwrap_or(false);
            set_ambient(app, on);
        }
        tray::ITEM_WALLPAPER => {
            let state = app.state::<Shared>();
            let mut runtime = state.runtime.lock().expect("runtime lock");
            runtime.settings.wallpaper_layer = !runtime.settings.wallpaper_layer;
            let enabled = runtime.settings.wallpaper_layer;
            let path = config_path(app);
            runtime.settings.save(&path);
            drop(runtime);
            apply_wallpaper_layer(app, enabled);
            sync_tray(app);
        }
        tray::ITEM_AUTOSTART => {
            let state = app.state::<Shared>();
            let mut runtime = state.runtime.lock().expect("runtime lock");
            runtime.settings.autostart = !runtime.settings.autostart;
            let enabled = runtime.settings.autostart;
            let path = config_path(app);
            runtime.settings.save(&path);
            drop(runtime);
            set_autostart(enabled);
            sync_tray(app);
            emit_snapshot(app);
        }
        tray::ITEM_QUIT => app.exit(0),
        _ => {}
    }
}

fn sync_tray(app: &AppHandle) {
    let state = app.state::<Shared>();
    let runtime = state.runtime.lock().expect("runtime lock");
    let ambient = ambient_window(app).map(|w| w.is_visible().unwrap_or(false)).unwrap_or(false);
    let wallpaper = runtime.settings.wallpaper_layer;
    let autostart = runtime.settings.autostart;
    drop(runtime);

    if let Some(tray_state) = app.try_state::<tray::TrayState>() {
        tray_state.sync(ambient, wallpaper, autostart);
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
    vec![
        "ship",
        "fisheye",
        "visual",
        "fisheye-visual",
        "codestyle",
        "codestyle-visual",
        "messages",
    ]
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
    {
        let mut runtime = state.runtime.lock().expect("runtime lock");
        runtime.settings = patch;
        runtime.settings.save(&config_path(&app));
        state.genius_parsing.store(
            runtime.settings.lyrics_allow_genius_page_parsing,
            Ordering::Relaxed,
        );
    }
    set_autostart(patch_autostart(&app));
    let wallpaper = patch_wallpaper(&app);
    apply_wallpaper_layer(&app, wallpaper);
    sync_tray(&app);
    emit_snapshot(&app);
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
    emit_snapshot(&app);
}

#[tauri::command]
fn toggle_play_pause() -> Result<(), String> {
    media::toggle_play_pause()
}

#[tauri::command]
fn set_ambient_mode(app: AppHandle, enabled: bool) {
    set_ambient(&app, enabled);
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
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let visible = app
                            .get_webview_window("ambient")
                            .map(|w| w.is_visible().unwrap_or(false))
                            .unwrap_or(false);
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
            let providers: Vec<Arc<dyn lyrics::LyricsProvider>> = vec![
                Arc::new(lyrics::local::LocalProvider::new(cache.clone())),
                Arc::new(lyrics::lrclib::LrclibProvider::new()),
                Arc::new(lyrics::genius::GeniusProvider::new(
                    credentials::read(credentials::GENIUS_TOKEN),
                    genius_parsing.clone(),
                )),
            ];
            let pipeline = Arc::new(lyrics::Pipeline::new(
                providers,
                cache.clone(),
                lyrics::PipelineConfig::default(),
            ));
            let initial_playback = media::snapshot();
            let saved_window = settings.window.clone();

            let accent_hotkey = settings.ambient_hotkey.clone();
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
                    error: None,
                }),
                cache,
                pipeline,
                genius_parsing,
            });

            tray::build(&handle, false, wallpaper_on, autostart_on)?;

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

            if wallpaper_on {
                let _ = ensure_ambient_window(&handle, 0);
                apply_wallpaper_layer(&handle, true);
            }
            let _ = ambient_on;

            start_poller(handle.clone());
            start_ambient_loop(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
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
            set_wallpaper_layer,
            reload_lyrics,
            open_preferences,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lyrica");
}

fn start_poller(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(POLL_MS));

        let playback = media::snapshot();
        let mut request: Option<(String, TrackQuery)> = None;

        {
            let state = app.state::<Shared>();
            let mut runtime = state.runtime.lock().expect("runtime lock");

            let key = if playback.is_active() { playback.key() } else { String::new() };
            if key != runtime.track_key {
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

fn start_ambient_loop(app: AppHandle) {
    std::thread::spawn(move || {
        let mut tick: u64 = 0;
        loop {
            std::thread::sleep(Duration::from_millis(1_000));
            tick += 1;

            let state = app.state::<Shared>();
            let idle_limit = {
                let runtime = state.runtime.lock().expect("runtime lock");
                runtime.settings.ambient_idle_minutes * 60
            };

            if tick % 2 != 0 {
                continue;
            }

            let idle = idle_seconds();
            let visible = ambient_window(&app)
                .map(|w| w.is_visible().unwrap_or(false))
                .unwrap_or(false);

            if idle_limit > 0 && idle >= idle_limit as u64 && !visible {
                set_ambient(&app, true);
            } else if visible && idle < 3 {
                set_ambient(&app, false);
            }

            #[cfg(windows)]
            {
                let hide_over_fullscreen = {
                    let runtime = state.runtime.lock().expect("runtime lock");
                    runtime.settings.hide_over_fullscreen
                };
                if visible && hide_over_fullscreen && overlay::exclusive_fullscreen_active() {
                    set_ambient(&app, false);
                }
            }
        }
    });
}
