//! Musixmatch: official API, optional, needs the user's own key. Free plans
//! return a truncated body and a copyright line that has to be shown, so both
//! are respected rather than pretending the text is complete.

use crate::lyrics::{
    matcher, plain_result, LyricsProvider, LyricsResult, ProviderError, Timing, TrackQuery,
};
use async_trait::async_trait;
use serde::Deserialize;
use std::time::Duration;

const BASE: &str = "https://api.musixmatch.com/ws/1.1";
const USER_AGENT: &str = "Lyrica/0.1 (Windows tray lyric player)";

pub struct MusixmatchProvider {
    key: Option<String>,
    client: reqwest::Client,
}

impl MusixmatchProvider {
    pub fn new(key: Option<String>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(6))
            .user_agent(USER_AGENT)
            .build()
            .unwrap_or_default();
        Self { key, client }
    }

    async fn call(
        &self,
        path: &str,
        query: &TrackQuery,
    ) -> Result<MessageBody, ProviderError> {
        let key = self.key.as_deref().ok_or(ProviderError::MissingCredentials)?;

        let response = self
            .client
            .get(format!("{BASE}/{path}"))
            .query(&[
                ("q_track", query.title.as_str()),
                ("q_artist", query.artist.as_str()),
                ("apikey", key),
                ("format", "json"),
            ])
            .send()
            .await
            .map_err(|error| {
                if error.is_connect() {
                    ProviderError::Offline
                } else if error.is_timeout() {
                    ProviderError::Timeout
                } else {
                    ProviderError::Upstream(error.to_string())
                }
            })?;

        match response.status() {
            status if status.is_success() => {}
            reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
                return Err(ProviderError::MissingCredentials)
            }
            reqwest::StatusCode::TOO_MANY_REQUESTS => {
                return Err(ProviderError::RateLimited {
                    retry_after_ms: 60_000,
                })
            }
            status => return Err(ProviderError::Upstream(format!("returned {status}"))),
        }

        let envelope: Envelope = response
            .json()
            .await
            .map_err(|error| ProviderError::Upstream(error.to_string()))?;

        if envelope.message.header.status_code == 401 {
            return Err(ProviderError::MissingCredentials);
        }
        if envelope.message.header.status_code == 429 {
            return Err(ProviderError::RateLimited {
                retry_after_ms: 60_000,
            });
        }

        Ok(envelope.message.body)
    }
}

#[async_trait]
impl LyricsProvider for MusixmatchProvider {
    fn id(&self) -> &'static str {
        "musixmatch"
    }

    fn name(&self) -> &'static str {
        "Musixmatch"
    }

    async fn fetch(&self, query: TrackQuery) -> Result<LyricsResult, ProviderError> {
        if self.key.is_none() {
            return Err(ProviderError::MissingCredentials);
        }

        // Synced first: the subtitle endpoint carries LRC with word tags.
        if let Ok(body) = self.call("matcher.subtitle.get", &query).await {
            if let Some(subtitle) = body.subtitle.as_ref() {
                if let Some(raw) = subtitle.subtitle_body.as_deref() {
                    if let Some(lyrics) = crate::lyrics::parse_lrc(raw, "Musixmatch") {
                        let mut result = super::lrclib::result_from_engine(lyrics, 0.9);
                        result.source = "Musixmatch".into();
                        result.attribution = Some("Lyrics from Musixmatch".into());
                        return Ok(result);
                    }
                }
            }
        }

        let body = self.call("matcher.lyrics.get", &query).await?;
        let lyrics = body.lyrics.ok_or(ProviderError::NotFound)?;

        if lyrics.restricted.unwrap_or(0) == 1 {
            return Err(ProviderError::Restricted);
        }
        if lyrics.instrumental.unwrap_or(0) == 1 {
            return Ok(LyricsResult {
                lines: Vec::new(),
                timing: Timing::Unsynced,
                source: "Musixmatch".into(),
                source_url: None,
                confidence: 0.7,
                attribution: Some("Instrumental track, per Musixmatch".into()),
                instrumental: true,
            });
        }

        let Some(text) = lyrics.lyrics_body.as_deref() else {
            return Err(ProviderError::NotFound);
        };

        let confidence = matcher::score(
            &query,
            &matcher::Candidate {
                title: lyrics.track_name.clone().unwrap_or_default(),
                artist: lyrics.artist_name.clone().unwrap_or_default(),
                album: None,
                duration_ms: None,
                flags: Vec::new(),
            },
        );
        let confidence = if confidence == 0.0 { 0.6 } else { confidence };

        let mut result = plain_result(text, "Musixmatch", confidence);
        // Free plans truncate the body and require this line to be shown.
        result.attribution = Some(
            lyrics
                .lyrics_copyright
                .clone()
                .filter(|line| !line.trim().is_empty())
                .unwrap_or_else(|| "Lyrics from Musixmatch".into()),
        );
        Ok(result)
    }
}

#[derive(Debug, Deserialize)]
struct Envelope {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct Message {
    header: Header,
    #[serde(default)]
    body: MessageBody,
}

#[derive(Debug, Deserialize)]
struct Header {
    #[serde(default)]
    status_code: i64,
}

#[derive(Debug, Default, Deserialize)]
struct MessageBody {
    #[serde(default)]
    subtitle: Option<Subtitle>,
    #[serde(default)]
    lyrics: Option<LyricsBody>,
}

#[derive(Debug, Deserialize)]
struct Subtitle {
    #[serde(default)]
    subtitle_body: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LyricsBody {
    #[serde(default)]
    lyrics_body: Option<String>,
    #[serde(default)]
    lyrics_copyright: Option<String>,
    #[serde(default)]
    instrumental: Option<i64>,
    #[serde(default)]
    restricted: Option<i64>,
    #[serde(default)]
    track_name: Option<String>,
    #[serde(default)]
    artist_name: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const PLAIN: &str = r#"{"message":{"header":{"status_code":200},"body":{"lyrics":{
        "lyrics_body":"invented line one\ninvented line two",
        "lyrics_copyright":"invented copyright line",
        "instrumental":0,"restricted":0,
        "track_name":"Invented Song","artist_name":"Invented Artist"}}}}"#;

    #[test]
    fn parses_a_plain_lyrics_body() {
        let envelope: Envelope = serde_json::from_str(PLAIN).expect("payload");
        assert_eq!(envelope.message.header.status_code, 200);
        let lyrics = envelope.message.body.lyrics.expect("lyrics");
        assert_eq!(lyrics.restricted, Some(0));
        assert!(lyrics.lyrics_body.unwrap_or_default().contains("invented line one"));
        assert_eq!(
            lyrics.lyrics_copyright.as_deref(),
            Some("invented copyright line")
        );
    }

    #[test]
    fn parses_a_subtitle_body() {
        let raw = r#"{"message":{"header":{"status_code":200},"body":{"subtitle":{
            "subtitle_body":"[00:12.00]<00:12.00>invented <00:12.50>line"}}}}"#;
        let envelope: Envelope = serde_json::from_str(raw).expect("payload");
        let subtitle = envelope.message.body.subtitle.expect("subtitle");
        assert!(subtitle
            .subtitle_body
            .unwrap_or_default()
            .contains("<00:12.50>"));
    }

    #[test]
    fn restricted_bodies_are_recognised() {
        let raw = r#"{"message":{"header":{"status_code":200},"body":{"lyrics":{
            "lyrics_body":"...","restricted":1}}}}"#;
        let envelope: Envelope = serde_json::from_str(raw).expect("payload");
        assert_eq!(
            envelope.message.body.lyrics.and_then(|lyrics| lyrics.restricted),
            Some(1)
        );
    }
}
