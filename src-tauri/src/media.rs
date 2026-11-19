//! Now-playing and transport control through the Windows media session
//! (`GlobalSystemMediaTransportControlsSessionManager`). Spotify and the Apple
//! Music app both publish there, so no account or permission prompt is involved.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playback {
    pub app: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// "playing" | "paused" | "stopped" | "none"
    pub status: String,
    /// Raw position reported by the session, at `sampled_at_ms`.
    pub position_ms: i64,
    pub duration_ms: i64,
    /// Unix milliseconds when this sample was taken; the UI extrapolates from here.
    pub sampled_at_ms: i64,
}

impl Playback {
    pub fn idle() -> Self {
        Self {
            app: String::new(),
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            status: "none".into(),
            position_ms: 0,
            duration_ms: 0,
            sampled_at_ms: now_ms(),
        }
    }

    pub fn is_active(&self) -> bool {
        !self.title.is_empty()
            && !self.artist.is_empty()
            && self.status != "none"
            && self.status != "stopped"
    }

    /// Track identity used for lyric lookups and cache keys.
    pub fn key(&self) -> String {
        format!(
            "{}|{}|{}",
            self.app.to_lowercase(),
            self.artist.to_lowercase(),
            self.title.to_lowercase()
        )
    }
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn friendly_app(id: &str) -> String {
    let lower = id.to_lowercase();
    if lower.contains("spotify") {
        "Spotify".into()
    } else if lower.contains("applemusic") || lower.contains("apple music") {
        "Apple Music".into()
    } else if lower.contains("zunemusic") || lower.contains("music.ui") {
        "Media Player".into()
    } else {
        id.trim_end_matches(".exe").to_string()
    }
}

#[cfg(windows)]
mod imp {
    use super::{friendly_app, now_ms, Playback};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as SessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    };

    /// Apps we prefer when several sessions are open at once.
    const PREFERRED: [&str; 4] = ["Spotify", "AppleMusic", "Music.UI", "ZuneMusic"];

    fn manager() -> Option<SessionManager> {
        SessionManager::RequestAsync().ok()?.get().ok()
    }

    fn status_of(session: &Session) -> PlaybackStatus {
        session
            .GetPlaybackInfo()
            .and_then(|info| info.PlaybackStatus())
            .unwrap_or(PlaybackStatus::Closed)
    }

    fn app_id(session: &Session) -> String {
        session
            .SourceAppUserModelId()
            .map(|id| id.to_string())
            .unwrap_or_default()
    }

    fn pick(manager: &SessionManager) -> Option<Session> {
        let sessions = manager.GetSessions().ok()?;
        let count = sessions.Size().unwrap_or(0);
        if count == 0 {
            return None;
        }

        let mut playing: Vec<Session> = Vec::new();
        let mut all: Vec<Session> = Vec::new();
        for index in 0..count {
            if let Ok(session) = sessions.GetAt(index) {
                if status_of(&session) == PlaybackStatus::Playing {
                    playing.push(session.clone());
                }
                all.push(session);
            }
        }

        let pool = if playing.is_empty() { &all } else { &playing };
        for wanted in PREFERRED {
            if let Some(session) = pool.iter().find(|s| app_id(s).contains(wanted)) {
                return Some(session.clone());
            }
        }
        pool.first().cloned()
    }

    pub fn snapshot() -> Playback {
        read().unwrap_or_else(Playback::idle)
    }

    fn read() -> Option<Playback> {
        let manager = manager()?;
        let session = pick(&manager)?;

        let status = match status_of(&session) {
            PlaybackStatus::Playing => "playing",
            PlaybackStatus::Paused => "paused",
            PlaybackStatus::Stopped | PlaybackStatus::Closed => "stopped",
            _ => "paused",
        };

        let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
        let title = props.Title().map(|v| v.to_string()).unwrap_or_default();
        let artist = props.Artist().map(|v| v.to_string()).unwrap_or_default();
        let album = props.AlbumTitle().map(|v| v.to_string()).unwrap_or_default();

        let timeline = session.GetTimelineProperties().ok();
        let (position_ms, duration_ms) = match timeline {
            Some(t) => {
                let ticks = |span: windows::Foundation::TimeSpan| span.Duration / 10_000;
                let start = t.StartTime().map(ticks).unwrap_or(0);
                let end = t.EndTime().map(ticks).unwrap_or(0);
                let position = t.Position().map(ticks).unwrap_or(0);
                (position.max(0), (end - start).max(0))
            }
            None => (0, 0),
        };

        Some(Playback {
            app: friendly_app(&app_id(&session)),
            title,
            artist,
            album,
            status: status.into(),
            position_ms,
            duration_ms,
            sampled_at_ms: now_ms(),
        })
    }

    pub fn toggle_play_pause() -> Result<(), String> {
        let manager = manager().ok_or_else(|| "no media session".to_string())?;
        let session = pick(&manager).ok_or_else(|| "nothing playing".to_string())?;
        session
            .TryTogglePlayPauseAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Playback;

    pub fn snapshot() -> Playback {
        Playback::idle()
    }

    pub fn toggle_play_pause() -> Result<(), String> {
        Err("media control is only available on Windows".into())
    }
}

pub use imp::{snapshot, toggle_play_pause};
