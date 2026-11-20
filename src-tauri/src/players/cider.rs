//! Cider (cider.sh) as a player source.
//!
//! Two API generations exist, so they stay behind separate adapters:
//! * v2 — the current REST API (`/api/v2/...`, `apptoken` header), documented at
//!   taproom.cider.sh/docs/api. Implemented here.
//! * v1 — the legacy `/api/v1/playback/*` generation (`apitoken` header). Only
//!   detected, so the UI can say what it found instead of guessing its payload.
//!
//! SMTC stays the fallback: Cider publishes a media session, so title, artist
//! and play state are available even with no token.

use crate::media::{now_ms, Playback};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Where Cider's API lives, plus the token from the Windows Credential Manager.
#[derive(Debug, Clone)]
pub struct CiderConfig {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    pub prefer_api: bool,
    pub token: Option<String>,
}

impl Default for CiderConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            host: "localhost".into(),
            port: 10_767,
            prefer_api: true,
            token: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CiderStatus {
    pub reachable: bool,
    /// "v2" | "legacyV1" | "none"
    pub api: String,
    pub version: Option<String>,
    pub port: Option<u16>,
    pub message: String,
}

impl CiderStatus {
    fn none(message: impl Into<String>) -> Self {
        Self {
            reachable: false,
            api: "none".into(),
            version: None,
            port: None,
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone)]
pub enum CiderError {
    Unreachable(String),
    Unauthorized,
    /// The server speaks the old v1 API, which is not implemented.
    LegacyApi,
    Status(u16),
    Decode(String),
}

impl CiderError {
    pub fn message(&self) -> String {
        match self {
            CiderError::Unreachable(detail) => format!("Cider is not reachable: {detail}"),
            CiderError::Unauthorized => {
                "Cider rejected the API token (Settings > Connectivity > Manage External Application Access)"
                    .into()
            }
            CiderError::LegacyApi => {
                "Cider is running the legacy v1 API; update Cider for the v2 API".into()
            }
            CiderError::Status(status) => format!("Cider answered with HTTP {status}"),
            CiderError::Decode(detail) => format!("unexpected Cider response: {detail}"),
        }
    }
}

pub struct CiderClient {
    base: String,
    token: Option<String>,
    http: reqwest::blocking::Client,
}

impl CiderClient {
    pub fn new(host: &str, port: u16, token: Option<String>) -> Self {
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_millis(1_200))
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new());

        Self {
            base: format!("http://{host}:{port}"),
            token,
            http,
        }
    }

    fn get(&self, path: &str) -> Result<reqwest::blocking::Response, CiderError> {
        let mut request = self.http.get(format!("{}{path}", self.base));
        if let Some(token) = &self.token {
            // v2 uses `apptoken`; the legacy generation used `apitoken`. Sending
            // both keeps one client working across versions.
            request = request
                .header("apptoken", token)
                .header("apitoken", token);
        }
        request.send().map_err(|error| {
            if error.is_connect() {
                CiderError::Unreachable(error.to_string())
            } else {
                CiderError::Status(0)
            }
        })
    }

    fn decode<T: serde::de::DeserializeOwned>(
        response: reqwest::blocking::Response,
    ) -> Result<T, CiderError> {
        response
            .json::<T>()
            .map_err(|error| CiderError::Decode(error.to_string()))
    }

    /// Confirms which API generation the running Cider speaks.
    pub fn ping(&self) -> CiderStatus {
        match self.get("/api/v2/client/info") {
            Ok(response) => {
                let status = response.status();
                if status == reqwest::StatusCode::UNAUTHORIZED
                    || status == reqwest::StatusCode::FORBIDDEN
                {
                    return CiderStatus {
                        reachable: true,
                        api: "v2".into(),
                        version: None,
                        port: None,
                        message: CiderError::Unauthorized.message(),
                    };
                }
                if status.is_success() {
                    if let Ok(envelope) = Self::decode::<Envelope<ClientInfo>>(response) {
                        return CiderStatus {
                            reachable: true,
                            api: "v2".into(),
                            version: Some(envelope.data.version),
                            port: Some(envelope.data.port),
                            message: "Connected to Cider's v2 API".into(),
                        };
                    }
                    return CiderStatus {
                        reachable: true,
                        api: "v2".into(),
                        version: None,
                        port: None,
                        message: "Cider's v2 API answered with an unexpected body".into(),
                    };
                }
                self.legacy_probe()
            }
            Err(CiderError::Unreachable(detail)) => CiderStatus::none(format!(
                "Nothing answered on {}. Is Cider running? ({detail})",
                self.base
            )),
            Err(error) => CiderStatus::none(error.message()),
        }
    }

    fn legacy_probe(&self) -> CiderStatus {
        match self.get("/api/v1/playback/active") {
            Ok(response) if response.status().is_success() => CiderStatus {
                reachable: true,
                api: "legacyV1".into(),
                version: None,
                port: None,
                message: "Cider is running its legacy v1 API".into(),
            },
            Ok(_) => CiderStatus::none("Cider answered, but not on a known API path"),
            Err(error) => CiderStatus::none(error.message()),
        }
    }

    /// Exact position and duration for what Cider is playing.
    pub fn playback(&self) -> Result<CiderPlayback, CiderError> {
        let response = self.get("/api/v2/playback")?;
        match response.status() {
            status if status.is_success() => {
                let envelope: Envelope<CiderPlayback> = Self::decode(response)?;
                Ok(envelope.data)
            }
            reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
                Err(CiderError::Unauthorized)
            }
            reqwest::StatusCode::NOT_FOUND => Err(CiderError::LegacyApi),
            status => Err(CiderError::Status(status.as_u16())),
        }
    }

    /// Apple Music's own lyrics, when Cider has them cached.
    pub fn lyrics(&self) -> Result<CiderLyrics, CiderError> {
        let response = self.get("/api/v2/lyrics/current?words=true")?;
        match response.status() {
            status if status.is_success() => {
                let envelope: Envelope<CiderLyrics> = Self::decode(response)?;
                Ok(envelope.data)
            }
            reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
                Err(CiderError::Unauthorized)
            }
            reqwest::StatusCode::NOT_FOUND => Err(CiderError::Status(404)),
            reqwest::StatusCode::GATEWAY_TIMEOUT => Err(CiderError::Status(504)),
            status => Err(CiderError::Status(status.as_u16())),
        }
    }
}

/// One snapshot from Cider, already shaped like the app's `Playback`.
///
/// Push first: the socket keeps position live. A REST read only happens when
/// the socket is down, silent, or reports a track change.
pub fn now_playing(config: &CiderConfig) -> Option<Playback> {
    // Also stops the socket when the user switches Cider off.
    crate::players::cider_push::ensure(config);

    if !config.enabled {
        return None;
    }

    if let Some(push) = crate::players::cider_push::current() {
        if push.take_refresh() {
            if let Some(fresh) = rest_playback(config) {
                push.update_track(&fresh);
                return Some(fresh);
            }
        }
        if let Some(playback) = push.playback() {
            return Some(playback);
        }
    }

    // Socket unavailable: poll the REST API instead.
    let playback = rest_playback(config)?;
    if let Some(push) = crate::players::cider_push::current() {
        push.update_track(&playback);
    }
    Some(playback)
}

fn rest_playback(config: &CiderConfig) -> Option<Playback> {
    CiderClient::new(&config.host, config.port, config.token.clone())
        .playback()
        .ok()?
        .to_playback()
}

pub fn test_connection(config: &CiderConfig) -> CiderStatus {
    CiderClient::new(&config.host, config.port, config.token.clone()).ping()
}

// ------------------------------------------------------------------ payloads

#[derive(Debug, Deserialize)]
struct Envelope<T> {
    data: T,
}

#[derive(Debug, Deserialize)]
struct ClientInfo {
    #[serde(default)]
    version: String,
    #[serde(default)]
    port: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CiderPlayback {
    #[serde(default)]
    state: String,
    #[serde(default)]
    now_playing: Option<NowPlaying>,
    #[serde(default)]
    time: Option<TimeInfo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NowPlaying {
    #[serde(default)]
    name: String,
    #[serde(default)]
    artist_name: String,
    #[serde(default)]
    album_name: String,
    #[serde(default)]
    duration_in_millis: Option<f64>,
    #[serde(default)]
    artwork: Option<Artwork>,
}

#[derive(Debug, Clone, Deserialize)]
struct Artwork {
    #[serde(default)]
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimeInfo {
    #[serde(default)]
    current_time: f64,
    #[serde(default)]
    duration: f64,
}

impl CiderPlayback {
    pub fn artwork_url(&self) -> Option<&str> {
        self.now_playing
            .as_ref()
            .and_then(|track| track.artwork.as_ref())
            .map(|artwork| artwork.url.as_str())
            .filter(|url| !url.is_empty())
    }

    /// `None` when Cider has nothing loaded, so SMTC can take over.
    pub fn to_playback(&self) -> Option<Playback> {
        let track = self.now_playing.as_ref()?;
        if track.name.trim().is_empty() {
            return None;
        }
        let state = self.state.to_lowercase();
        if state == "stopped" && track.artist_name.trim().is_empty() {
            return None;
        }

        let position_ms = self
            .time
            .as_ref()
            .map(|time| (time.current_time.max(0.0) * 1000.0).round() as i64)
            .unwrap_or(0);
        let duration_ms = track
            .duration_in_millis
            .map(|value| value.max(0.0).round() as i64)
            .or_else(|| {
                self.time
                    .as_ref()
                    .map(|time| (time.duration.max(0.0) * 1000.0).round() as i64)
            })
            .unwrap_or(0);

        Some(Playback {
            app: "Cider".into(),
            title: track.name.clone(),
            artist: track.artist_name.clone(),
            album: track.album_name.clone(),
            status: match state.as_str() {
                "playing" => "playing",
                "paused" => "paused",
                _ => "stopped",
            }
            .into(),
            position_ms,
            duration_ms,
            sampled_at_ms: now_ms(),
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CiderLyrics {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub source: Option<LyricsSource>,
    #[serde(default)]
    pub lines: Vec<LyricsLine>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsSource {
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub timing_type: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsLine {
    #[serde(default)]
    pub start: Option<f64>,
    #[serde(default)]
    pub end: Option<f64>,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub empty: bool,
    #[serde(default)]
    pub words: Option<Vec<LyricsWord>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LyricsWord {
    #[serde(default)]
    pub start: Option<f64>,
    #[serde(default)]
    pub end: Option<f64>,
    #[serde(default)]
    pub text: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    const CLIENT_INFO: &str = r#"{"data":{"framework":"universal","platform":"win32","osVersion":"10.0.22631","port":10767,"production":true,"version":"2.5.2"}}"#;

    const PLAYBACK: &str = r#"{"data":{
        "state":"playing",
        "nowPlaying":{"name":"Invented Song","artistName":"Invented Artist","albumName":"Invented Album",
            "artwork":{"url":"https://example.invalid/art.jpg","width":600,"height":600},
            "durationInMillis":240000,"inFavorites":true,"inLibrary":true,"flavor":"256"},
        "time":{"currentTime":45.25,"duration":240,"remaining":194.75},
        "volume":0.75,"repeatMode":"none","shuffleMode":false,"autoplay":true,"rate":1.0}}"#;

    const LYRICS: &str = r#"{"data":{"id":"1613600188",
        "source":{"provider":"apple-music","timingType":"Word","language":"en"},
        "lines":[{"start":12.3,"end":15.1,"text":"Invented first line","empty":false,
            "words":[{"start":12.3,"end":12.9,"text":"Invented"},{"start":12.9,"end":13.6,"text":"first"}]}]}}"#;

    /// A throwaway HTTP server so the client is exercised over a real socket.
    fn serve(routes: Vec<(&'static str, &'static str)>) -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();

        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { break };
                let mut buffer = [0u8; 4096];
                let read = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..read]).to_string();
                let path = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                    .unwrap_or("/")
                    .to_string();

                let body = routes
                    .iter()
                    .find(|(route, _)| path.starts_with(route))
                    .map(|(_, body)| *body);

                let response = match body {
                    Some(body) => format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    ),
                    None => {
                        "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string()
                    }
                };
                let _ = stream.write_all(response.as_bytes());
            }
        });

        port
    }

    #[test]
    fn detects_the_v2_api() {
        let port = serve(vec![("/api/v2/client/info", CLIENT_INFO)]);
        let status = CiderClient::new("127.0.0.1", port, None).ping();
        assert!(status.reachable);
        assert_eq!(status.api, "v2");
        assert_eq!(status.version.as_deref(), Some("2.5.2"));
        assert_eq!(status.port, Some(10767));
    }

    #[test]
    fn reports_legacy_api_instead_of_guessing() {
        let port = serve(vec![]);
        let status = CiderClient::new("127.0.0.1", port, None).ping();
        assert_eq!(status.api, "none");
        assert!(status.message.contains("Cider"));
    }

    #[test]
    fn maps_playback_to_the_app_snapshot() {
        let port = serve(vec![("/api/v2/playback", PLAYBACK)]);
        let playback = CiderClient::new("127.0.0.1", port, None)
            .playback()
            .expect("playback");

        let snapshot = playback.to_playback().expect("a track");
        assert_eq!(snapshot.app, "Cider");
        assert_eq!(snapshot.title, "Invented Song");
        assert_eq!(snapshot.artist, "Invented Artist");
        assert_eq!(snapshot.status, "playing");
        assert_eq!(snapshot.position_ms, 45_250);
        assert_eq!(snapshot.duration_ms, 240_000);
        assert_eq!(
            playback.artwork_url(),
            Some("https://example.invalid/art.jpg")
        );
    }

    #[test]
    fn pausing_keeps_the_track_position() {
        let paused = PLAYBACK.replace("\"playing\"", "\"paused\"");
        let port = serve(vec![("/api/v2/playback", Box::leak(paused.into_boxed_str()))]);
        let snapshot = CiderClient::new("127.0.0.1", port, None)
            .playback()
            .expect("playback")
            .to_playback()
            .expect("a track");
        assert_eq!(snapshot.status, "paused");
        assert_eq!(snapshot.position_ms, 45_250);
    }

    #[test]
    fn parses_word_synced_lyrics() {
        let port = serve(vec![("/api/v2/lyrics/current", LYRICS)]);
        let lyrics = CiderClient::new("127.0.0.1", port, None)
            .lyrics()
            .expect("lyrics");

        assert_eq!(
            lyrics.source.as_ref().map(|s| s.timing_type.as_str()),
            Some("Word")
        );
        assert_eq!(lyrics.lines.len(), 1);
        assert!((lyrics.lines[0].start.unwrap_or(0.0) - 12.3).abs() < 0.001);
        assert_eq!(lyrics.lines[0].words.as_ref().map(Vec::len), Some(2));
    }

    #[test]
    fn sends_the_token_in_both_header_generations() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();

        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0u8; 4096];
            let read = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..read]).to_lowercase();
            let _ = stream.write_all(
                b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            );
            request
        });

        let _ = CiderClient::new("127.0.0.1", port, Some("secret-token".into())).ping();
        let request = handle.join().expect("server thread");
        assert!(request.contains("apptoken: secret-token"), "{request}");
        assert!(request.contains("apitoken: secret-token"), "{request}");
    }
}
