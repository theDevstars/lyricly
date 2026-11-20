pub mod analyze;

#[cfg(windows)]
mod capture;

use analyze::AudioView;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

static VIEW: OnceLock<Mutex<AudioView>> = OnceLock::new();

fn slot() -> &'static Mutex<AudioView> {
    VIEW.get_or_init(|| Mutex::new(AudioView::silent()))
}

/// The latest analysis, or a silent view when capture is unavailable.
pub fn view() -> AudioView {
    slot()
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| AudioView::silent())
}

pub fn publish(next: AudioView) {
    if let Ok(mut guard) = slot().lock() {
        *guard = next;
    }
}

pub fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|span| span.as_millis() as f64)
        .unwrap_or(0.0)
}

/// Starts loopback capture on a background thread. Safe to call once; failures
/// leave the silent view in place so the styles fall back to lyric energy.
pub fn start() {
    #[cfg(windows)]
    capture::spawn();
}
