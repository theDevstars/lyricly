//! Lyrics from Cider: Apple Music's own lyrics through `/api/v2/lyrics/current`,
//! which can be word-synced, line-synced or plain.

use crate::lyrics::{
    matcher, LyricsProvider, LyricsResult, ProviderError, ProviderLine, ProviderWord, Timing,
    TrackQuery,
};
use crate::players::cider::{CiderClient, CiderError};
use async_trait::async_trait;
use std::sync::{Arc, RwLock};

pub struct CiderLyricsProvider {
    config: Arc<RwLock<crate::players::CiderConfig>>,
}

impl CiderLyricsProvider {
    pub fn new(config: Arc<RwLock<crate::players::CiderConfig>>) -> Self {
        Self { config }
    }
}

#[async_trait]
impl LyricsProvider for CiderLyricsProvider {
    fn id(&self) -> &'static str {
        "cider"
    }

    fn name(&self) -> &'static str {
        "Cider / Apple Music"
    }

    async fn fetch(&self, query: TrackQuery) -> Result<LyricsResult, ProviderError> {
        let config = {
            let guard = self
                .config
                .read()
                .map_err(|_| ProviderError::Upstream("cider config is unavailable".into()))?;
            guard.clone()
        };

        if !config.enabled {
            return Err(ProviderError::NotFound);
        }

        // The Cider client is blocking, so keep it off the async worker.
        let fetched = tokio::task::spawn_blocking(move || {
            let client = CiderClient::new(&config.host, config.port, config.token.clone());
            let playback = client.playback()?;
            let lyrics = client.lyrics()?;
            Ok::<_, CiderError>((playback, lyrics))
        })
        .await
        .map_err(|error| ProviderError::Upstream(error.to_string()))?;

        let (playback, lyrics) = fetched.map_err(|error| match error {
            CiderError::Unauthorized => ProviderError::MissingCredentials,
            CiderError::Unreachable(_) => ProviderError::Offline,
            CiderError::LegacyApi | CiderError::Status(404) | CiderError::Status(504) => {
                ProviderError::NotFound
            }
            other => ProviderError::Upstream(other.message()),
        })?;

        // `/lyrics/current` follows Cider's own player, which may not be the
        // track we are showing. Refuse when they disagree.
        let track = playback.to_playback().ok_or(ProviderError::NotFound)?;
        let confidence = matcher::score(
            &query,
            &matcher::Candidate {
                title: track.title.clone(),
                artist: track.artist.clone(),
                album: Some(track.album.clone()),
                duration_ms: (track.duration_ms > 0).then_some(track.duration_ms),
                flags: Vec::new(),
            },
        );
        if confidence < 0.5 {
            return Err(ProviderError::NotFound);
        }

        let timing = match lyrics
            .source
            .as_ref()
            .map(|source| source.timing_type.to_lowercase())
            .unwrap_or_default()
            .as_str()
        {
            "word" => Timing::WordSynced,
            "line" => Timing::LineSynced,
            _ => Timing::Unsynced,
        };

        let lines: Vec<ProviderLine> = lyrics
            .lines
            .iter()
            .filter(|line| !line.empty && !line.text.trim().is_empty())
            .map(|line| ProviderLine {
                start_ms: seconds_to_ms(line.start),
                end_ms: seconds_to_ms(line.end),
                text: line.text.trim().to_string(),
                words: line.words.as_ref().map(|words| {
                    words
                        .iter()
                        .map(|word| ProviderWord {
                            text: word.text.clone(),
                            start_ms: seconds_to_ms(word.start),
                            end_ms: seconds_to_ms(word.end),
                        })
                        .collect()
                }),
            })
            .collect();

        if lines.is_empty() {
            return Err(ProviderError::NotFound);
        }

        Ok(LyricsResult {
            lines,
            timing,
            source: "Cider / Apple Music".into(),
            source_url: None,
            confidence,
            attribution: Some("Lyrics from Apple Music, via Cider".into()),
            instrumental: false,
        })
    }
}

fn seconds_to_ms(value: Option<f64>) -> Option<u32> {
    value
        .filter(|seconds| *seconds >= 0.0)
        .map(|seconds| (seconds * 1000.0).round() as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lyrics::LyricsResult;

    #[test]
    fn converts_seconds_to_milliseconds() {
        assert_eq!(seconds_to_ms(Some(12.35)), Some(12_350));
        assert_eq!(seconds_to_ms(None), None);
        assert_eq!(seconds_to_ms(Some(-1.0)), None);
    }

    #[test]
    fn word_synced_lines_convert_to_engine_timing() {
        let result = LyricsResult {
            lines: vec![ProviderLine {
                start_ms: seconds_to_ms(Some(12.3)),
                end_ms: seconds_to_ms(Some(15.1)),
                text: "Invented first line".into(),
                words: Some(vec![
                    ProviderWord {
                        text: "Invented".into(),
                        start_ms: seconds_to_ms(Some(12.3)),
                        end_ms: seconds_to_ms(Some(12.9)),
                    },
                    ProviderWord {
                        text: "first".into(),
                        start_ms: seconds_to_ms(Some(12.9)),
                        end_ms: seconds_to_ms(Some(13.6)),
                    },
                ]),
            }],
            timing: Timing::WordSynced,
            source: "Cider / Apple Music".into(),
            source_url: None,
            confidence: 0.9,
            attribution: None,
            instrumental: false,
        };

        let engine = result.to_engine().expect("engine lyrics");
        assert_eq!(engine.lines[0].start_ms, 12_300);
        assert_eq!(engine.lines[0].words[1].start_ms, 12_900);
        assert!(engine.lines[0].exact);
    }
}
