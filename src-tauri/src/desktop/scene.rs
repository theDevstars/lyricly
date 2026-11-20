//! One desktop scene window per monitor, hosted in the wallpaper layer behind
//! the icons. The scene is display-only: clicks belong to the desktop, and edit
//! mode will use a separate overlay rather than trying to make a wallpaper
//! child interactive.
//!
//! A scene child dies with the shell: Explorer restarting destroys the
//! `WorkerW`, and Windows destroys its children with it. The stale Tauri window
//! object cannot be reused, so each generation gets a fresh label and window.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::monitors::{self, MonitorTarget};
use super::workerw;

/// Whether the app believes the scene should be up. The supervisor only ever
/// repairs a scene the user asked for, so hiding stays hidden.
static ACTIVE: AtomicBool = AtomicBool::new(false);

/// Which generation of each scene label is current. Bumped when a window dies
/// with the shell, because a dead label cannot be reused.
fn generations() -> &'static Mutex<HashMap<String, u32>> {
    static GENERATIONS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    GENERATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn label_for(base: &str) -> String {
    let generation = generations()
        .lock()
        .expect("generations lock")
        .get(base)
        .copied()
        .unwrap_or(0);
    if generation == 0 {
        base.to_string()
    } else {
        format!("{base}-g{generation}")
    }
}

fn bump_generation(base: &str) {
    *generations()
        .lock()
        .expect("generations lock")
        .entry(base.to_string())
        .or_insert(0) += 1;
}

/// Last rect each window was placed at, so an unchanged monitor does not get a
/// fresh `SetWindowPos` on every supervisor tick.
fn placements() -> &'static Mutex<HashMap<String, (i32, i32, i32, i32)>> {
    static PLACED: OnceLock<Mutex<HashMap<String, (i32, i32, i32, i32)>>> = OnceLock::new();
    PLACED.get_or_init(|| Mutex::new(HashMap::new()))
}

fn forget_placement(label: &str) {
    placements().lock().expect("placements lock").remove(label);
}

fn scene_hwnd(window: &WebviewWindow) -> Option<isize> {
    window.hwnd().ok().map(|handle| handle.0 as isize)
}

fn build(app: &AppHandle, label: &str) -> Option<WebviewWindow> {
    match WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Lyrica Scene")
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .build()
    {
        Ok(window) => Some(window),
        Err(error) => {
            eprintln!("scene: window {label} failed: {error}");
            None
        }
    }
}

fn place(window: &WebviewWindow, hwnd: isize, label: &str, target: &MonitorTarget) {
    let rect = (target.x, target.y, target.width, target.height);
    let unchanged = {
        let mut placed = placements().lock().expect("placements lock");
        match placed.get(label) {
            Some(last) if *last == rect => true,
            _ => {
                placed.insert(label.to_string(), rect);
                false
            }
        }
    };
    if unchanged {
        return;
    }

    if !workerw::place(hwnd, rect.0, rect.1, rect.2, rect.3) {
        eprintln!("scene: could not place {label} inside the wallpaper layer");
    }
}

fn put_in_wallpaper(window: &WebviewWindow, label: &str, target: &MonitorTarget) {
    let Some(hwnd) = scene_hwnd(window) else {
        eprintln!("scene: {label} has no window handle");
        return;
    };

    if !workerw::is_attached(hwnd) {
        // Never leave an orphaned scene floating above the desktop while the
        // shell is coming back: hide it, attach, and hide again on failure.
        let _ = window.hide();
        // A window has to be visible before Windows will parent it into the
        // wallpaper layer, and WebView2 only starts its frame loop for a
        // controller it believes is visible.
        let _ = window.show();
        forget_placement(label);
        let attach = workerw::attach(hwnd);
        if !attach.ok() {
            eprintln!(
                "scene: {label} attach failed to {} (win32 0x{:X}, parent 0x{:X})",
                attach.class, attach.win32_error, attach.parent
            );
            let _ = window.hide();
            return;
        }
        eprintln!("scene: {label} attached to {}", attach.class);
    }

    place(window, hwnd, label, target);
}

/// Puts every monitor's scene where it belongs, creating windows for new
/// monitors and hiding windows whose monitor is gone. Returns the labels that
/// are up.
pub fn reconcile(app: &AppHandle) -> Vec<String> {
    let targets = monitors::targets(app);
    reconcile_targets(app, &targets)
}

/// The same pass against an explicit monitor list, so a test can pretend a
/// display was unplugged without touching the hardware.
pub fn reconcile_targets(app: &AppHandle, targets: &[MonitorTarget]) -> Vec<String> {
    let mut up = Vec::new();

    for target in targets {
        let base = target.label();
        let label = label_for(&base);

        let window = match app.get_webview_window(&label) {
            Some(window) => {
                let dead = scene_hwnd(&window).is_none_or(|hwnd| !workerw::is_alive(hwnd));
                if dead {
                    eprintln!("scene: {label} died with the shell, recreating");
                    let _ = window.destroy();
                    bump_generation(&base);
                    forget_placement(&label);
                    // The replacement is built on the next tick, once the old
                    // label has been released.
                    continue;
                }
                window
            }
            None => match build(app, &label) {
                Some(window) => window,
                None => continue,
            },
        };

        put_in_wallpaper(&window, &label, target);
        up.push(label);
    }

    // A monitor that went away keeps its window (hidden, not destroyed), so
    // plugging it back in restores the same scene instead of a new one.
    for (label, window) in app.webview_windows() {
        if !label.starts_with("scene") || up.contains(&label) {
            continue;
        }
        forget_placement(&label);
        let _ = window.hide();
    }

    up
}

pub fn show_all(app: &AppHandle) -> Vec<String> {
    ACTIVE.store(true, Ordering::Relaxed);
    reconcile(app)
}

pub fn hide_all(app: &AppHandle) {
    ACTIVE.store(false, Ordering::Relaxed);
    for (label, window) in app.webview_windows() {
        if label.starts_with("scene") {
            let _ = window.hide();
        }
    }
}

/// Keeps the scene attached while it is up: Explorer restarts replace the
/// wallpaper layer, and monitors get plugged in, moved and rescaled.
pub fn start_supervisor(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(2_000));
        if !ACTIVE.load(Ordering::Relaxed) {
            continue;
        }
        reconcile(&handle);
    });
}
