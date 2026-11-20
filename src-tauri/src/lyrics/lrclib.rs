//! LRCLIB: free, no key required. `/api/get` first, then `/api/search`, with a
//! preference for records whose duration is within two seconds of the track.

use crate::lyrics::{
    matcher, Lyrics, LyricsProvider, LyricsResult, ProviderError, ProviderLine, ProviderWord,
    Timing, TrackQuery,
};
use async_trait::async_trait;
use serde::Deserialize;
use std::time::Duration;

const BASE: &str = "https://lrclib.net/api";
const USER_AGENT: &str = "Lyrica/0.1 (Windows tray lyric player)";

pub struct LrclibProvider {
    client: reqwest::Client,
}

impl LrclibProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(6))
            .user_agent(USER_AGENT)
            .build()
            .unwrap_or_default();
        Self { client }
    }

    async fn get(&self, query: &TrackQuery, title: &str) -> Result<Option<Record>, ProviderError> {
        let mut params: Vec<(&str, String)> = vec![
            ("track_name", title.to_string()),
            ("artist_name", query.artist.clone()),
        ];
        if !query.album.is_empty() {
            params.push(("album_name", query.album.clone()));
        }
        if query.duration_ms > 0 {
            let seconds = (query.duration_ms as f64 / 1000.0).round() as i64;
            params.push(("duration", seconds.to_string()));
        }

        let response = send(self.client.get(format!("{BASE}/get")).query(&params)).await?;
        if !response.status().is_success() {
            return Ok(None);
        }
        Ok(response.json::<Record>().await.ok())
    }

    async fn search(&self, query: &TrackQuery) -> Result<Vec<Record>, ProviderError> {
        let params = [
            ("track_name", query.title.clone()),
            ("artist_name", query.artist.clone()),
        ];
        let response = send(self.client.get(format!("{BASE}/search")).query(&params)).await?;
        if !response.status().is_success() {
            return Ok(Vec::new());
        }
        Ok(response.json::<Vec<Record>>().await.unwrap_or_default())
    }
}

#[async_trait]
impl LyricsProvider for LrclibProvider {
    fn id(&self) -> &'static str {
        "lrclib"
    }

    fn name(&self) -> &'static str {
        "LRCLIB"
    }

    async fn fetch(&self, query: TrackQuery) -> Result<LyricsResult, ProviderError> {
        // The original title first, then the cleaned one, so Spotify and Apple
        // Music spellings both get a chance.
        for variant in matcher::title_variants(&query.title) {
            if let Some(record) = self.get(&query, &variant).await? {
                if let Some(result) = record.into_result(&query) {
                    if result.confidence >= 0.5 {
                        return Ok(result);
                    }
                }
            }
        }

        let records = self.search(&query).await?;
        let mut scored: Vec<(f32, Record)> = records
            .into_iter()
            .map(|record| (record.confidence(&query), record))
            .filter(|(score, record)| *score >= 0.3 && record.has_lyrics())
            .collect();

        scored.sort_by(|left, right| {
            right
                .0
                .partial_cmp(&left.0)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        scored
            .into_iter()
            .find_map(|(_, record)| record.into_result(&query))
            .ok_or(ProviderError::NotFound)
    }
}

#[derive(Debug, Clone, Deserialize)]
struct Record {
    #[serde(rename = "trackName")]
    track_name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    duration: Option<f64>,
    instrumental: Option<bool>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

impl Record {
    fn has_lyrics(&self) -> bool {
        self.synced_lyrics.is_some() || self.plain_lyrics.is_some()
    }

    fn candidate(&self) -> matcher::Candidate {
        matcher::Candidate {
            title: self.track_name.clone().unwrap_or_default(),
            artist: self.artist_name.clone().unwrap_or_default(),
            album: self.album_name.clone(),
            duration_ms: self.duration.map(|seconds| (seconds * 1000.0) as i64),
            flags: Vec::new(),
        }
    }

    fn confidence(&self, query: &TrackQuery) -> f32 {
        matcher::score(query, &self.candidate())
    }

    fn into_result(self, query: &TrackQuery) -> Option<LyricsResult> {
        let confidence = self.confidence(query);

        if self.instrumental.unwrap_or(false) {
            return Some(LyricsResult {
                lines: Vec::new(),
                timing: Timing::Unsynced,
                source: "LRCLIB".into(),
                source_url: None,
                confidence: confidence.max(0.5),
                attribution: Some("Instrumental track, per LRCLIB".into()),
                instrumental: true,
            });
        }

        if let Some(synced) = self.synced_lyrics.as_deref() {
            if let Some(lyrics) = crate::lyrics::parse_lrc(synced, "LRCLIB") {
                return Some(result_from_engine(lyrics, confidence));
            }
        }

        self.plain_lyrics
            .as_deref()
            .map(|plain| crate::lyrics::plain_result(plain, "LRCLIB", confidence))
    }
}

/// Adapts parsed LRC to a provider result, keeping word timings.
pub fn result_from_engine(lyrics: Lyrics, confidence: f32) -> LyricsResult {
    let timing = if lyrics.lines.iter().any(|line| line.exact) {
        Timing::WordSynced
    } else {
        Timing::LineSynced
    };

    let lines: Vec<ProviderLine> = lyrics
        .lines
        .iter()
        .map(|line| ProviderLine {
            start_ms: Some(clamp_ms(line.start_ms)),
            end_ms: Some(clamp_ms(line.end_ms)),
            text: line.text.clone(),
            words: Some(
                line.words
                    .iter()
                    .map(|word| ProviderWord {
                        text: word.text.clone(),
                        start_ms: Some(clamp_ms(word.start_ms)),
                        end_ms: Some(clamp_ms(word.end_ms)),
                    })
                    .collect(),
            ),
        })
        .collect();

    LyricsResult {
        lines,
        timing,
        source: lyrics.source.clone(),
        source_url: None,
        confidence,
        attribution: Some(format!("Lyrics from {}", lyrics.source)),
        instrumental: false,
    }
}

fn clamp_ms(value: i64) -> u32 {
    value.clamp(0, u32::MAX as i64) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "hits the live LRCLIB API"]
    async fn finds_a_known_track_online() {
        let provider = LrclibProvider::new();
        let query = TrackQuery {
            title: "Slow Dancing in the Dark".into(),
            artist: "Joji".into(),
            album: String::new(),
            duration_ms: 209_000,
        };

        let result = provider.fetch(query).await.expect("LRCLIB result");
        assert!(result.lines.len() > 10, "got {} lines", result.lines.len());
        assert!(matches!(
            result.timing,
            Timing::WordSynced | Timing::LineSynced
        ));
        assert!(result.confidence > 0.6, "confidence {}", result.confidence);
        assert!(result.to_engine().is_some());
    }

    #[tokio::test]
    #[ignore = "hits the live LRCLIB API"]
    async fn reports_not_found_for_nonsense() {
        let provider = LrclibProvider::new();
        let query = TrackQuery {
            title: "Zzzqqq nonextant track 419".into(),
            artist: "Nobody At All".into(),
            album: String::new(),
            duration_ms: 123_000,
        };
        assert!(provider.fetch(query).await.is_err());
    }
}

async fn send(request: reqwest::RequestBuilder) -> Result<reqwest::Response, ProviderError> {
    match request.send().await {
        Ok(response) => {
            if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                let retry_after_ms = response
                    .headers()
                    .get(reqwest::header::RETRY_AFTER)
                    .and_then(|value| value.to_str().ok())
                    .and_then(|value| value.trim().parse::<u64>().ok())
                    .map(|seconds| seconds * 1_000)
                    .unwrap_or(5_000);
                return Err(ProviderError::RateLimited { retry_after_ms });
            }
            Ok(response)
        }
        Err(error) if error.is_connect() => Err(ProviderError::Offline),
        Err(error) if error.is_timeout() => Err(ProviderError::Timeout),
        Err(error) => Err(ProviderError::Upstream(error.to_string())),
    }
}
