//! Spotify account linking.
//!
//! Authorization Code with PKCE, no client secret: the flow opens the system
//! browser, catches the redirect on a loopback listener bound to 127.0.0.1 and
//! verifies `state`. Tokens live in Windows Credential Manager and never touch
//! the settings file or the log. Once linked, the Web API supplies the track,
//! its high-res artwork and a precise position, which takes precedence over the
//! SMTC sample while it is fresh.

use crate::credentials;
use crate::settings::Settings;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

pub const AUTH_URL: &str = "https://accounts.spotify.com/authorize";
pub const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
pub const API: &str = "https://api.spotify.com/v1";

/// Always requested: reading the player state is the whole point.
pub const SCOPES_READ: &str = "user-read-playback-state user-read-currently-playing";
/// Only requested when the user turns controls on.
pub const SCOPES_CONTROLS: &str = "user-modify-playback-state";

const CALLBACK_PATH: &str = "/callback";
const REFRESH_MARGIN_MS: i64 = 60_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyStatus {
    pub linked: bool,
    pub client_id: String,
    pub client_id_set: bool,
    pub redirect_uri: String,
    pub account: Option<String>,
    pub product: Option<String>,
    pub premium: bool,
    pub controls: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyPlayback {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub uri: String,
    pub isrc: Option<String>,
    pub artwork_url: Option<String>,
    pub position_ms: i64,
    pub duration_ms: i64,
    pub playing: bool,
    pub device: Option<String>,
    pub shuffle: bool,
    pub repeat: String,
    /// Unix ms when the response arrived, for drift correction.
    pub sampled_at_ms: i64,
}

#[derive(Debug, Clone)]
pub struct Tokens {
    pub access: String,
    pub refresh: Option<String>,
    pub expires_in: i64,
}

/// The redirect URI Spotify has to have registered exactly, port included.
pub fn redirect_uri(port: u16) -> String {
    format!("http://127.0.0.1:{port}{CALLBACK_PATH}")
}

pub fn scopes(controls: bool) -> String {
    if controls {
        format!("{SCOPES_READ} {SCOPES_CONTROLS}")
    } else {
        SCOPES_READ.to_string()
    }
}

pub fn authorize_url(
    client_id: &str,
    redirect: &str,
    challenge: &str,
    state: &str,
    scopes: &str,
) -> String {
    format!(
        "{AUTH_URL}?client_id={}&response_type=code&redirect_uri={}&code_challenge_method=S256&code_challenge={}&state={}&scope={}",
        urlencoding::encode(client_id),
        urlencoding::encode(redirect),
        urlencoding::encode(challenge),
        urlencoding::encode(state),
        urlencoding::encode(scopes),
    )
}

fn random_token(bytes: usize) -> String {
    let mut buffer = vec![0u8; bytes];
    getrandom::getrandom(&mut buffer).expect("randomness");
    URL_SAFE_NO_PAD.encode(buffer)
}

/// PKCE pair: a 64-byte verifier and its S256 challenge.
pub fn pkce_pair() -> (String, String) {
    let verifier = random_token(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

/// Position between polls: interpolate with the local clock and clamp.
pub fn position_at(sample: &SpotifyPlayback, now_ms: i64) -> i64 {
    let mut position = sample.position_ms;
    if sample.playing {
        position += (now_ms - sample.sampled_at_ms).max(0);
    }
    if sample.duration_ms > 0 {
        position = position.min(sample.duration_ms);
    }
    position.max(0)
}

/// `Retry-After` in seconds, clamped to something a poll loop can live with.
pub fn retry_after_seconds(header: Option<&str>) -> u64 {
    header
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(2)
        .clamp(1, 60)
}

/// Shape the Web API sample as the app's own playback record.
pub fn to_local_playback(sample: &SpotifyPlayback) -> crate::media::Playback {
    crate::media::Playback {
        app: "Spotify".into(),
        title: sample.title.clone(),
        artist: sample.artist.clone(),
        album: sample.album.clone(),
        status: if sample.playing { "playing" } else { "paused" }.into(),
        position_ms: position_at(sample, crate::media::now_ms()),
        duration_ms: sample.duration_ms,
        sampled_at_ms: crate::media::now_ms(),
    }
}

// ------------------------------------------------------------------ HTTP

fn http() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new())
}

fn token_request(form: &[(&str, &str)]) -> Result<Tokens, String> {
    let response = http()
        .post(TOKEN_URL)
        .form(form)
        .send()
        .map_err(|error| format!("spotify: {error}"))?;

    let status = response.status();
    let text = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(describe_auth_error(&text));
    }

    let value: serde_json::Value =
        serde_json::from_str(&text).map_err(|_| "spotify: unreadable token response".to_string())?;

    Ok(Tokens {
        access: value["access_token"].as_str().unwrap_or_default().to_string(),
        refresh: value["refresh_token"].as_str().map(str::to_string),
        expires_in: value["expires_in"].as_i64().unwrap_or(3600),
    })
}

/// Turns Spotify's JSON error into something a person can act on.
pub fn describe_auth_error(body: &str) -> String {
    if body.contains("invalid_client") {
        return "Spotify rejected the Client ID. Check it in the Spotify developer dashboard.".into();
    }
    if body.contains("invalid_grant") {
        return "The Spotify session expired. Disconnect and link again.".into();
    }
    if body.contains("invalid_redirect_uri") {
        return "The redirect URI is not registered for this Spotify app.".into();
    }
    if body.contains("invalid_request") || body.contains("error") {
        return "Spotify refused the request. Check the app's settings and the redirect URI.".into();
    }
    "Spotify could not be reached. Try again.".into()
}

pub fn exchange_code(
    client_id: &str,
    code: &str,
    verifier: &str,
    redirect: &str,
) -> Result<Tokens, String> {
    token_request(&[
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect),
        ("client_id", client_id),
        ("code_verifier", verifier),
    ])
}

pub fn refresh_access_token(client_id: &str, refresh: &str) -> Result<Tokens, String> {
    token_request(&[
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh),
        ("client_id", client_id),
    ])
}

/// The loopback listener for the redirect. Prefers the configured port so the
/// registered URI keeps matching.
pub fn bind_listener(port: u16) -> Result<TcpListener, String> {
    TcpListener::bind(("127.0.0.1", port)).map_err(|error| {
        format!("could not listen on 127.0.0.1:{port} ({error}); close whatever is using it or pick another port")
    })
}

pub fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("could not open the browser: {error}"))
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("only implemented on Windows".into())
    }
}

/// Blocks until the browser comes back with a code, or the timeout expires.
pub fn wait_for_code(
    listener: TcpListener,
    expected_state: &str,
    timeout: Duration,
) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let started = Instant::now();

    loop {
        if started.elapsed() > timeout {
            return Err("the browser never came back — try linking again".into());
        }

        match listener.accept() {
            Ok((mut stream, _)) => {
                let request = read_request(&mut stream);
                respond(&mut stream);
                match parse_callback(&request) {
                    Ok(Callback::Code { code, state }) if state == expected_state => return Ok(code),
                    Ok(Callback::Code { .. }) => {
                        return Err("the login response did not match this request (state mismatch)".into())
                    }
                    Ok(Callback::Error(message)) => return Err(message),
                    Err(error) => return Err(error),
                }
            }
            Err(ref error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(error) => return Err(format!("callback listener: {error}")),
        }
    }
}

enum Callback {
    Code { code: String, state: String },
    Error(String),
}

fn read_request(stream: &mut TcpStream) -> String {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buffer = [0u8; 4096];
    let read = stream.read(&mut buffer).unwrap_or(0);
    String::from_utf8_lossy(&buffer[..read]).to_string()
}

fn respond(stream: &mut TcpStream) {
    let body = "<!doctype html><meta charset=\"utf-8\"><title>Lyrica</title>\
<body style=\"font-family:system-ui;background:#0b0d11;color:#eef1f7;display:grid;\
place-items:center;height:100vh;margin:0\"><div style=\"text-align:center\">\
<h1 style=\"font-weight:600\">Spotify is linked</h1>\
<p style=\"color:#9aa3b2\">You can close this tab and go back to Lyrica.</p></div>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
}

/// Reads `?code=...&state=...` (or `?error=...`) out of the request line.
fn parse_callback(request: &str) -> Result<Callback, String> {
    let line = request.lines().next().unwrap_or_default();
    let target = line.split_whitespace().nth(1).unwrap_or_default();
    let query = target.split_once('?').map(|(_, query)| query).unwrap_or("");

    let mut code = None;
    let mut state = None;
    let mut error = None;

    for pair in query.split('&') {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        let value = urlencoding::decode(value).unwrap_or_else(|_| value.into()).to_string();
        match key {
            "code" => code = Some(value),
            "state" => state = Some(value),
            "error" => error = Some(value),
            _ => {}
        }
    }

    if let Some(error) = error {
        let message = if error == "access_denied" {
            "linking was cancelled in the browser".to_string()
        } else {
            format!("Spotify returned {error}")
        };
        return Ok(Callback::Error(message));
    }

    match (code, state) {
        (Some(code), Some(state)) => Ok(Callback::Code { code, state }),
        _ => Err("the redirect did not include a code".into()),
    }
}

// --------------------------------------------------------------- the flow

pub struct LinkRequest {
    pub client_id: String,
    pub port: u16,
    pub controls: bool,
}

pub struct LinkResult {
    pub tokens: Tokens,
    pub redirect: String,
}

/// Runs the whole interactive flow. Blocking: call it off the UI thread.
pub fn link(request: &LinkRequest) -> Result<LinkResult, String> {
    if request.client_id.trim().is_empty() {
        return Err(
            "add a Spotify Client ID first — the app ships without one so nothing is shared by default"
                .into(),
        );
    }

    let listener = bind_listener(request.port)?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let redirect = redirect_uri(port);

    let (verifier, challenge) = pkce_pair();
    let state = random_token(16);
    let url = authorize_url(
        request.client_id.trim(),
        &redirect,
        &challenge,
        &state,
        &scopes(request.controls),
    );

    open_browser(&url)?;
    let code = wait_for_code(listener, &state, Duration::from_secs(180))?;
    let tokens = exchange_code(request.client_id.trim(), &code, &verifier, &redirect)?;

    Ok(LinkResult { tokens, redirect })
}

// ------------------------------------------------------------------- state

fn config(settings: &Settings) -> (String, u16, bool) {
    (
        settings.spotify_client_id.trim().to_string(),
        settings.spotify_redirect_port.max(1024),
        settings.spotify_controls,
    )
}

pub fn status(settings: &Settings) -> SpotifyStatus {
    let (client_id, port, controls) = config(settings);
    SpotifyStatus {
        linked: credentials::read(credentials::SPOTIFY_REFRESH).is_some(),
        client_id_set: !client_id.is_empty(),
        client_id,
        redirect_uri: redirect_uri(port),
        account: (!settings.spotify_account.is_empty()).then(|| settings.spotify_account.clone()),
        product: (!settings.spotify_product.is_empty()).then(|| settings.spotify_product.clone()),
        premium: settings.spotify_product.eq_ignore_ascii_case("premium"),
        controls,
        error: None,
    }
}

pub fn store_tokens(tokens: &Tokens) -> Result<i64, String> {
    credentials::write(credentials::SPOTIFY_ACCESS, &tokens.access)?;
    if let Some(refresh) = tokens.refresh.as_deref() {
        credentials::write(credentials::SPOTIFY_REFRESH, refresh)?;
    }
    Ok(crate::media::now_ms() + tokens.expires_in * 1000)
}

pub fn forget_tokens() {
    let _ = credentials::delete(credentials::SPOTIFY_ACCESS);
    let _ = credentials::delete(credentials::SPOTIFY_REFRESH);
}

/// An access token that is good for at least another minute, refreshing early
/// when it is not.
pub fn access_token(settings: &Settings) -> Result<String, String> {
    let (client_id, _, _) = config(settings);
    let refresh = credentials::read(credentials::SPOTIFY_REFRESH)
        .ok_or("Spotify is not linked on this PC")?;

    let fresh = settings.spotify_expires_at_ms - REFRESH_MARGIN_MS > crate::media::now_ms();
    if fresh {
        if let Some(access) = credentials::read(credentials::SPOTIFY_ACCESS) {
            if !access.is_empty() {
                return Ok(access);
            }
        }
    }

    let tokens = refresh_access_token(&client_id, &refresh)?;
    let expires_at = store_tokens(&tokens)?;
    let _ = expires_at;
    Ok(tokens.access)
}

// --------------------------------------------------------------- endpoints

#[derive(Debug)]
pub enum ApiError {
    Unauthorized,
    PremiumRequired,
    RateLimited(u64),
    Nothing,
    Other(String),
}

impl ApiError {
    pub fn message(&self) -> String {
        match self {
            Self::Unauthorized => "Spotify needs to be linked again".into(),
            Self::PremiumRequired => {
                "Spotify Premium is required for playback controls".into()
            }
            Self::RateLimited(seconds) => {
                format!("Spotify asked us to slow down; retrying in {seconds}s")
            }
            Self::Nothing => "nothing is playing on Spotify".into(),
            Self::Other(detail) => detail.clone(),
        }
    }
}

pub fn classify(status: u16) -> Result<(), ApiError> {
    match status {
        200..=204 => Ok(()),
        401 => Err(ApiError::Unauthorized),
        403 => Err(ApiError::PremiumRequired),
        429 => Err(ApiError::RateLimited(2)),
        other => Err(ApiError::Other(format!("Spotify returned HTTP {other}"))),
    }
}

pub fn parse_playback(value: &serde_json::Value, sampled_at_ms: i64) -> Option<SpotifyPlayback> {
    let item = value.get("item")?;
    if item.is_null() {
        return None;
    }

    let title = item["name"].as_str().unwrap_or_default().to_string();
    if title.is_empty() {
        return None;
    }

    let artists: Vec<String> = item["artists"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|artist| artist["name"].as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    let artwork = item["album"]["images"]
        .as_array()
        .and_then(|images| {
            images
                .iter()
                .filter_map(|image| image["url"].as_str())
                .max_by_key(|url| url.len())
                .map(str::to_string)
        });

    Some(SpotifyPlayback {
        title,
        artist: artists.join(", "),
        album: item["album"]["name"].as_str().unwrap_or_default().to_string(),
        uri: item["uri"].as_str().unwrap_or_default().to_string(),
        isrc: item["external_ids"]["isrc"].as_str().map(str::to_string),
        artwork_url: artwork,
        position_ms: value["progress_ms"].as_i64().unwrap_or(0),
        duration_ms: item["duration_ms"].as_i64().unwrap_or(0),
        playing: value["is_playing"].as_bool().unwrap_or(false),
        device: value["device"]["name"].as_str().map(str::to_string),
        shuffle: value["shuffle_state"].as_bool().unwrap_or(false),
        repeat: value["repeat_state"].as_str().unwrap_or("off").to_string(),
        sampled_at_ms,
    })
}

pub fn fetch_now_playing(token: &str) -> Result<Option<SpotifyPlayback>, ApiError> {
    let response = http()
        .get(format!("{API}/me/player"))
        .bearer_auth(token)
        .send()
        .map_err(|error| ApiError::Other(error.to_string()))?;

    let status = response.status().as_u16();
    if status == 204 {
        return Ok(None);
    }
    if status == 429 {
        let retry = response
            .headers()
            .get("retry-after")
            .and_then(|value| value.to_str().ok())
            .map(|value| retry_after_seconds(Some(value)))
            .unwrap_or(2);
        return Err(ApiError::RateLimited(retry));
    }
    classify(status)?;

    let text = response.text().map_err(|error| ApiError::Other(error.to_string()))?;
    let value: serde_json::Value =
        serde_json::from_str(&text).map_err(|_| ApiError::Other("unreadable player response".into()))?;
    Ok(parse_playback(&value, crate::media::now_ms()))
}

/// Display name and product for the linked account (`product` is "premium",
/// "free" or empty).
pub fn fetch_profile(token: &str) -> Result<(String, String), ApiError> {
    let response = http()
        .get(format!("{API}/me"))
        .bearer_auth(token)
        .send()
        .map_err(|error| ApiError::Other(error.to_string()))?;

    classify(response.status().as_u16())?;
    let text = response.text().map_err(|error| ApiError::Other(error.to_string()))?;
    let value: serde_json::Value = serde_json::from_str(&text)
        .map_err(|_| ApiError::Other("unreadable profile response".into()))?;

    Ok((
        value["display_name"]
            .as_str()
            .or_else(|| value["id"].as_str())
            .unwrap_or_default()
            .to_string(),
        value["product"].as_str().unwrap_or_default().to_string(),
    ))
}

/// Player commands. `value` carries the argument for seek/volume/repeat.
pub fn control(token: &str, action: &str, value: Option<&str>) -> Result<(), ApiError> {
    let client = http();
    let request = match action {
        "play" => client.put(format!("{API}/me/player/play")),
        "pause" => client.put(format!("{API}/me/player/pause")),
        "next" => client.post(format!("{API}/me/player/next")),
        "previous" => client.post(format!("{API}/me/player/previous")),
        "seek" => client.put(format!(
            "{API}/me/player/seek?position_ms={}",
            value.unwrap_or("0")
        )),
        "volume" => client.put(format!(
            "{API}/me/player/volume?volume_percent={}",
            value.unwrap_or("50")
        )),
        "shuffle" => client.put(format!(
            "{API}/me/player/shuffle?state={}",
            value.unwrap_or("true")
        )),
        "repeat" => client.put(format!(
            "{API}/me/player/repeat?state={}",
            value.unwrap_or("off")
        )),
        other => return Err(ApiError::Other(format!("unknown player action {other}"))),
    };

    let response = request
        .bearer_auth(token)
        .header("Content-Length", "0")
        .send()
        .map_err(|error| ApiError::Other(error.to_string()))?;

    classify(response.status().as_u16())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_redirect_uri_is_a_loopback_address() {
        assert_eq!(redirect_uri(8888), "http://127.0.0.1:8888/callback");
        assert!(!redirect_uri(8888).contains("localhost"));
    }

    #[test]
    fn scopes_start_with_read_and_add_controls_only_when_asked() {
        assert_eq!(scopes(false), SCOPES_READ);
        assert!(scopes(true).contains("user-modify-playback-state"));
        assert!(!scopes(false).contains("user-modify-playback-state"));
    }

    #[test]
    fn the_authorize_url_carries_pkce_and_state() {
        let url = authorize_url("abc", "http://127.0.0.1:8888/callback", "chal", "st", SCOPES_READ);
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("code_challenge=chal"));
        assert!(url.contains("state=st"));
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A8888%2Fcallback"));
    }

    #[test]
    fn pkce_pairs_are_s256_and_url_safe() {
        let (verifier, challenge) = pkce_pair();
        assert!(verifier.len() >= 43 && verifier.len() <= 128);
        let expected = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
        assert_eq!(challenge, expected);
        assert!(!challenge.contains('=') && !challenge.contains('+') && !challenge.contains('/'));
    }

    #[test]
    fn the_position_interpolates_and_clamps() {
        let sample = SpotifyPlayback {
            position_ms: 1_000,
            duration_ms: 5_000,
            playing: true,
            sampled_at_ms: 10_000,
            ..Default::default()
        };
        assert_eq!(position_at(&sample, 12_000), 3_000);
        assert_eq!(position_at(&sample, 99_000), 5_000);
        let paused = SpotifyPlayback {
            playing: false,
            ..sample.clone()
        };
        assert_eq!(position_at(&paused, 99_000), 1_000);
    }

    #[test]
    fn retry_after_is_parsed_and_clamped() {
        assert_eq!(retry_after_seconds(Some("7")), 7);
        assert_eq!(retry_after_seconds(Some("0")), 1);
        assert_eq!(retry_after_seconds(Some("9999")), 60);
        assert_eq!(retry_after_seconds(None), 2);
        assert_eq!(retry_after_seconds(Some("nonsense")), 2);
    }

    #[test]
    fn status_codes_map_to_actionable_errors() {
        assert!(matches!(classify(204), Ok(())));
        assert!(matches!(classify(401), Err(ApiError::Unauthorized)));
        assert!(matches!(classify(403), Err(ApiError::PremiumRequired)));
        assert!(matches!(classify(429), Err(ApiError::RateLimited(_))));
        assert!(matches!(classify(500), Err(ApiError::Other(_))));
    }

    #[test]
    fn a_player_response_becomes_a_track() {
        let value: serde_json::Value = serde_json::from_str(
            r#"{"is_playing":true,"progress_ms":42000,"shuffle_state":false,"repeat_state":"off",
                "device":{"name":"Kitchen speaker"},
                "item":{"uri":"spotify:track:invented","name":"Invented Song","duration_ms":200000,
                        "artists":[{"name":"Invented Band"}],
                        "album":{"name":"Invented Album","images":[{"url":"https://example.invalid/small.jpg"},{"url":"https://example.invalid/large-artwork-name.jpg"}]},
                        "external_ids":{"isrc":"XXAAA0000001"}}}"#,
        )
        .unwrap();

        let track = parse_playback(&value, 1_000).expect("track");
        assert_eq!(track.title, "Invented Song");
        assert_eq!(track.artist, "Invented Band");
        assert_eq!(track.duration_ms, 200_000);
        assert_eq!(track.isrc.as_deref(), Some("XXAAA0000001"));
        assert_eq!(track.device.as_deref(), Some("Kitchen speaker"));
        assert_eq!(
            track.artwork_url.as_deref(),
            Some("https://example.invalid/large-artwork-name.jpg")
        );
        assert_eq!(position_at(&track, 3_000), 44_000);
    }

    #[test]
    fn idle_and_unknown_items_are_not_tracks() {
        let idle: serde_json::Value = serde_json::from_str(r#"{"item":null,"is_playing":false}"#).unwrap();
        assert!(parse_playback(&idle, 0).is_none());
        let empty: serde_json::Value = serde_json::from_str(r#"{"item":{"name":""}}"#).unwrap();
        assert!(parse_playback(&empty, 0).is_none());
    }

    #[test]
    fn the_callback_is_parsed_with_state() {
        let request = "GET /callback?code=abc%2F123&state=xyz HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
        match parse_callback(request) {
            Ok(Callback::Code { code, state }) => {
                assert_eq!(code, "abc/123");
                assert_eq!(state, "xyz");
            }
            _ => panic!("expected a code"),
        }

        let denied = "GET /callback?error=access_denied HTTP/1.1\r\n\r\n";
        assert!(matches!(parse_callback(denied), Ok(Callback::Error(_))));
        assert!(parse_callback("GET /favicon.ico HTTP/1.1\r\n\r\n").is_err());
    }

    #[test]
    fn auth_errors_are_explained() {
        assert!(describe_auth_error(r#"{"error":"invalid_client"}"#).contains("Client ID"));
        assert!(describe_auth_error(r#"{"error":"invalid_grant"}"#).contains("link again"));
        assert!(describe_auth_error("garbled").contains("could not be reached"));
    }
}
