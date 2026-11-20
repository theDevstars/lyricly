//! Socket.IO subscription to Cider's `API:Playback` channel.
//!
//! Cider broadcasts `playbackStatus.playbackTimeDidChange` about once a second,
//! plus track and state changes, so position no longer has to be polled from
//! the REST API. When the socket is down (or silent for a few seconds) the
//! caller falls back to a REST read.
//!
//! Transport: Engine.IO v4 over WebSocket. The polling handshake only fetches a
//! session id; all traffic after that is a single socket.

use crate::media::{now_ms, Playback};
use crate::players::cider::CiderConfig;
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tungstenite::client::IntoClientRequest;
use tungstenite::{connect, Message};

/// Without any event for this long the socket counts as dead.
const STALE_MS: i64 = 5_000;
const CHANNEL: &str = "API:Playback";

#[derive(Debug, Clone, Default)]
struct TrackMeta {
    title: String,
    artist: String,
    album: String,
    duration_ms: i64,
}

#[derive(Debug, Default)]
struct Inner {
    track: Option<TrackMeta>,
    position_secs: f64,
    sampled_at_ms: i64,
    status: String,
    connected: bool,
    updated_at_ms: i64,
    refresh: bool,
}

#[derive(Debug, Default)]
pub struct CiderPush {
    inner: Mutex<Inner>,
}

impl CiderPush {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().expect("cider push lock")
    }

    fn mark_connected(&self) {
        let mut inner = self.lock();
        inner.connected = true;
        inner.updated_at_ms = now_ms();
    }

    fn mark_disconnected(&self) {
        self.lock().connected = false;
    }

    fn apply_event(&self, packet: &str) {
        let Some((channel, body)) = parse_api_event(packet) else {
            return;
        };
        if channel != CHANNEL {
            return;
        }

        let kind = body
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let data = body.get("data").cloned().unwrap_or(Value::Null);

        let mut inner = self.lock();
        inner.updated_at_ms = now_ms();

        match kind.as_str() {
            "playbackStatus.playbackTimeDidChange" => {
                if let Some(position) = data.get("currentPlaybackTime").and_then(Value::as_f64) {
                    inner.position_secs = position.max(0.0);
                    inner.sampled_at_ms = now_ms();
                }
                if let Some(playing) = data.get("isPlaying").and_then(Value::as_bool) {
                    inner.status = if playing { "playing" } else { "paused" }.into();
                }
            }
            "playbackStatus.playbackStateDidChange" => {
                if let Some(state) = data.get("state").and_then(Value::as_str) {
                    inner.status = match state.to_lowercase().as_str() {
                        "playing" => "playing",
                        "paused" => "paused",
                        _ => "stopped",
                    }
                    .into();
                }
            }
            "playbackStatus.nowPlayingItemDidChange" => {
                // The payload is Apple Music track attributes; a single REST
                // read gives us the fields the app needs without guessing.
                inner.refresh = true;
            }
            _ => {}
        }
    }

    pub fn take_refresh(&self) -> bool {
        let mut inner = self.lock();
        std::mem::replace(&mut inner.refresh, false)
    }

    /// Stores metadata from a REST read: after a track change, or when the
    /// socket is not the source.
    pub fn update_track(&self, playback: &Playback) {
        let mut inner = self.lock();
        inner.track = Some(TrackMeta {
            title: playback.title.clone(),
            artist: playback.artist.clone(),
            album: playback.album.clone(),
            duration_ms: playback.duration_ms,
        });
        inner.position_secs = playback.position_ms as f64 / 1000.0;
        inner.sampled_at_ms = playback.sampled_at_ms;
        inner.status = playback.status.clone();
        inner.updated_at_ms = now_ms();
    }

    /// A push snapshot, or `None` when the socket is down or silent.
    pub fn playback(&self) -> Option<Playback> {
        let inner = self.lock();
        if !inner.connected || now_ms() - inner.updated_at_ms > STALE_MS {
            return None;
        }
        let track = inner.track.as_ref()?;

        let elapsed = if inner.status == "playing" {
            (now_ms() - inner.sampled_at_ms).max(0) as f64 / 1000.0
        } else {
            0.0
        };
        let position_ms = ((inner.position_secs + elapsed) * 1000.0).round() as i64;

        Some(Playback {
            app: "Cider".into(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album.clone(),
            status: if inner.status.is_empty() {
                "paused".into()
            } else {
                inner.status.clone()
            },
            position_ms: position_ms.max(0),
            duration_ms: track.duration_ms,
            sampled_at_ms: now_ms(),
        })
    }
}

struct Handle {
    fingerprint: String,
    running: Arc<AtomicBool>,
    push: Arc<CiderPush>,
}

static PUSH: OnceLock<Mutex<Option<Handle>>> = OnceLock::new();

/// Starts, keeps or stops the subscription for the current settings.
pub fn ensure(config: &CiderConfig) {
    let registry = PUSH.get_or_init(|| Mutex::new(None));
    let mut slot = match registry.lock() {
        Ok(slot) => slot,
        Err(_) => return,
    };

    if !config.enabled {
        if let Some(handle) = slot.take() {
            handle.running.store(false, Ordering::Relaxed);
        }
        return;
    }

    // The token itself is never kept in this string.
    let fingerprint = format!(
        "{}:{}:{}",
        config.host,
        config.port,
        config.token.as_ref().map(|token| token.len()).unwrap_or(0)
    );

    if slot
        .as_ref()
        .map(|handle| handle.fingerprint == fingerprint)
        .unwrap_or(false)
    {
        return;
    }

    if let Some(handle) = slot.take() {
        handle.running.store(false, Ordering::Relaxed);
    }

    let push = Arc::new(CiderPush::default());
    let running = Arc::new(AtomicBool::new(true));

    let thread_config = config.clone();
    let thread_push = push.clone();
    let thread_running = running.clone();
    std::thread::spawn(move || run(thread_config, thread_push, thread_running));

    *slot = Some(Handle {
        fingerprint,
        running,
        push,
    });
}

pub fn current() -> Option<Arc<CiderPush>> {
    PUSH.get()?
        .lock()
        .ok()?
        .as_ref()
        .map(|handle| handle.push.clone())
}

fn run(config: CiderConfig, push: Arc<CiderPush>, running: Arc<AtomicBool>) {
    let mut backoff_ms: u64 = 500;

    while running.load(Ordering::Relaxed) {
        match subscribe(&config, &push, &running) {
            Ok(()) => backoff_ms = 500,
            Err(error) => eprintln!("cider socket: {error}"),
        }

        push.mark_disconnected();
        if !running.load(Ordering::Relaxed) {
            break;
        }
        std::thread::sleep(Duration::from_millis(backoff_ms));
        backoff_ms = (backoff_ms * 2).min(10_000);
    }
}

/// Runs one connection until it closes or the app tears it down.
fn subscribe(
    config: &CiderConfig,
    push: &CiderPush,
    running: &AtomicBool,
) -> Result<(), String> {
    let http = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|error| error.to_string())?;

    let handshake_url = format!(
        "http://{}:{}/socket.io/?EIO=4&transport=polling",
        config.host, config.port
    );
    let mut handshake = http.get(&handshake_url);
    if let Some(token) = &config.token {
        handshake = handshake.header("apptoken", token).header("apitoken", token);
    }

    let body = handshake
        .send()
        .map_err(|error| error.to_string())?
        .text()
        .map_err(|error| error.to_string())?;

    let sid = session_id(&body).ok_or_else(|| "no session id in handshake".to_string())?;

    let url = format!(
        "ws://{}:{}/socket.io/?EIO=4&transport=websocket&sid={sid}",
        config.host, config.port
    );

    let mut request = url
        .into_client_request()
        .map_err(|error| error.to_string())?;
    if let Some(token) = &config.token {
        if let Ok(value) = tungstenite::http::HeaderValue::from_str(token) {
            request
                .headers_mut()
                .insert(tungstenite::http::HeaderName::from_static("apptoken"), value);
        }
    }

    let (mut socket, _) = connect(request).map_err(|error| error.to_string())?;
    socket
        .send(Message::Text("2probe".into()))
        .map_err(|error| error.to_string())?;

    loop {
        let message = socket.read().map_err(|error| error.to_string())?;
        match message {
            Message::Text(text) => {
                let text = text.as_str();
                if text == "3probe" {
                    socket
                        .send(Message::Text("5".into()))
                        .map_err(|error| error.to_string())?;
                } else if text == "2" {
                    socket
                        .send(Message::Text("3".into()))
                        .map_err(|error| error.to_string())?;
                } else if text == "40" || text == "40{}" {
                    push.mark_connected();
                } else if text.starts_with("42") {
                    push.mark_connected();
                    push.apply_event(text);
                }
            }
            Message::Ping(payload) => {
                let _ = socket.send(Message::Pong(payload));
            }
            Message::Close(_) => return Ok(()),
            _ => {}
        }

        if !running.load(Ordering::Relaxed) {
            let _ = socket.close(None);
            return Ok(());
        }
    }
}

fn session_id(body: &str) -> Option<String> {
    let payload = body.trim_start_matches(|ch: char| ch.is_ascii_digit());
    let parsed: Value = serde_json::from_str(payload).ok()?;
    parsed
        .get("sid")
        .and_then(Value::as_str)
        .map(|sid| sid.to_string())
}

/// `42["API:Playback",{...}]` → channel and body.
pub fn parse_api_event(packet: &str) -> Option<(String, Value)> {
    let payload = packet.strip_prefix("42")?;
    let array: Value = serde_json::from_str(payload).ok()?;
    let items = array.as_array()?;
    let channel = items.first()?.as_str()?.to_string();
    Some((channel, items.get(1).cloned().unwrap_or(Value::Null)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn packet(kind: &str, data: &str) -> String {
        format!(r#"42["API:Playback",{{"type":"{kind}","data":{data}}}]"#)
    }

    fn connected_push() -> Arc<CiderPush> {
        let push = Arc::new(CiderPush::default());
        push.mark_connected();
        push.update_track(&Playback {
            app: "Cider".into(),
            title: "Invented Song".into(),
            artist: "Invented Artist".into(),
            album: "Invented Album".into(),
            status: "playing".into(),
            position_ms: 10_000,
            duration_ms: 200_000,
            sampled_at_ms: now_ms(),
        });
        push
    }

    #[test]
    fn parses_the_handshake_session_id() {
        let body = r#"0{"sid":"abc123","upgrades":["websocket"],"pingInterval":25000}"#;
        assert_eq!(session_id(body).as_deref(), Some("abc123"));
    }

    #[test]
    fn parses_an_api_playback_event() {
        let (channel, body) = parse_api_event(&packet("playbackStatus.playbackTimeDidChange", "{}"))
            .expect("event");
        assert_eq!(channel, "API:Playback");
        assert_eq!(
            body.get("type").and_then(Value::as_str),
            Some("playbackStatus.playbackTimeDidChange")
        );
    }

    #[test]
    fn ignores_non_event_packets() {
        assert!(parse_api_event("40").is_none());
        assert!(parse_api_event("2").is_none());
        assert!(parse_api_event("3probe").is_none());
    }

    #[test]
    fn other_channels_are_ignored_by_the_handler() {
        let push = connected_push();
        push.apply_event(r#"42["Other:Channel",{"type":"playbackStatus.playbackStateDidChange","data":{"state":"paused"}}]"#);
        assert_eq!(
            push.playback().expect("push playback").status,
            "playing",
            "events from other channels must not touch playback"
        );
    }

    #[test]
    fn time_events_move_the_position() {
        let push = connected_push();
        push.apply_event(&packet(
            "playbackStatus.playbackTimeDidChange",
            r#"{"currentPlaybackTime":75.5,"currentPlaybackDuration":200,"currentPlaybackTimeRemaining":124.5,"isPlaying":true}"#,
        ));

        let playback = push.playback().expect("push playback");
        assert_eq!(playback.title, "Invented Song");
        assert_eq!(playback.status, "playing");
        let position = playback.position_ms;
        assert!(
            (75_500..76_600).contains(&position),
            "position should be near 75.5s, got {position}"
        );
    }

    #[test]
    fn paused_events_stop_the_clock() {
        let push = connected_push();
        push.apply_event(&packet(
            "playbackStatus.playbackTimeDidChange",
            r#"{"currentPlaybackTime":40.0,"isPlaying":false}"#,
        ));

        let first = push.playback().expect("push playback").position_ms;
        std::thread::sleep(Duration::from_millis(60));
        let second = push.playback().expect("push playback").position_ms;
        assert_eq!(first, 40_000);
        assert_eq!(second, 40_000, "a paused track must not advance");
    }

    #[test]
    fn state_events_update_the_status() {
        let push = connected_push();
        push.apply_event(&packet(
            "playbackStatus.playbackStateDidChange",
            r#"{"attributes":{},"state":"paused"}"#,
        ));
        assert_eq!(push.playback().expect("push playback").status, "paused");

        push.apply_event(&packet(
            "playbackStatus.playbackStateDidChange",
            r#"{"attributes":{},"state":"stopped"}"#,
        ));
        assert_eq!(push.playback().expect("push playback").status, "stopped");
    }

    #[test]
    fn track_changes_ask_for_one_rest_refresh() {
        let push = connected_push();
        push.apply_event(&packet(
            "playbackStatus.nowPlayingItemDidChange",
            r#"{"name":"Next Song"}"#,
        ));
        assert!(push.take_refresh(), "first read should ask for a refresh");
        assert!(!push.take_refresh(), "the flag is one-shot");
    }

    #[test]
    fn a_disconnected_socket_yields_no_playback() {
        let push = connected_push();
        push.mark_disconnected();
        assert!(
            push.playback().is_none(),
            "a dropped socket must fall back to polling"
        );
    }

    #[test]
    fn a_silent_socket_goes_stale() {
        let push = connected_push();
        {
            let mut inner = push.lock();
            inner.updated_at_ms = now_ms() - STALE_MS - 1_000;
        }
        assert!(
            push.playback().is_none(),
            "silence for longer than the window means fall back to REST"
        );
    }
}
