//! Timed lyrics: enhanced LRC parsing (per-word tags when present), a syllable
//! based split for plain LRC, the provider pipeline, and LRCLIB lookups.

pub mod auto_timing;
pub mod cache;
pub mod cider;
pub mod genius;
pub mod musixmatch;
pub mod local;
pub mod lrclib;
pub mod matcher;

use async_trait::async_trait;
use futures::stream::{FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricWord {
    pub text: String,
    pub start_ms: i64,
    pub end_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub start_ms: i64,
    pub end_ms: i64,
    pub text: String,
    pub words: Vec<LyricWord>,
    /// True when the words carry real timestamps instead of an even split.
    pub exact: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lyrics {
    pub source: String,
    pub lines: Vec<LyricLine>,
    /// Attribution the source requires, shown on the lyric view.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attribution: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timing: Option<Timing>,
    #[serde(default)]
    pub confidence: f32,
}

/// The track being looked up, independent of any provider.
#[derive(Debug, Clone)]
pub struct TrackQuery {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
}

fn parse_timestamp(minutes: &str, seconds: &str, fraction: &str) -> Option<i64> {
    let minutes: i64 = minutes.parse().ok()?;
    let seconds: i64 = seconds.parse().ok()?;
    let millis = match fraction.len() {
        0 => 0,
        1 => fraction.parse::<i64>().ok()? * 100,
        2 => fraction.parse::<i64>().ok()? * 10,
        _ => fraction[..3].parse::<i64>().ok()?,
    };
    Some(minutes * 60_000 + seconds * 1_000 + millis)
}

/// Reads `[mm:ss.xx]` (or `[mm:ss:xx]`) at a position, returning time and the
/// index just past the tag.
fn read_time_tag(input: &str) -> Option<(i64, usize)> {
    let bytes = input.as_bytes();
    if bytes.first() != Some(&b'[') {
        return None;
    }
    let close = input.find(']')?;
    let body = &input[1..close];
    let colon = body.find(':')?;
    let (minutes, rest) = body.split_at(colon);
    let rest = &rest[1..];
    let (seconds, fraction) = match rest.find(['.', ':']) {
        Some(index) => (&rest[..index], &rest[index + 1..]),
        None => (rest, ""),
    };
    let time = parse_timestamp(minutes.trim(), seconds.trim(), fraction.trim())?;
    Some((time, close + 1))
}

fn read_word_tag(input: &str) -> Option<(i64, usize)> {
    let bytes = input.as_bytes();
    if bytes.first() != Some(&b'<') {
        return None;
    }
    let close = input.find('>')?;
    let body = &input[1..close];
    let colon = body.find(':')?;
    let (minutes, rest) = body.split_at(colon);
    let rest = &rest[1..];
    let (seconds, fraction) = match rest.find(['.', ':']) {
        Some(index) => (&rest[..index], &rest[index + 1..]),
        None => (rest, ""),
    };
    let time = parse_timestamp(minutes.trim(), seconds.trim(), fraction.trim())?;
    Some((time, close + 1))
}

/// Pulls `<mm:ss.xx>word` pairs out of a line, plus the plain text.
fn split_words(content: &str) -> (String, Vec<(i64, String)>, bool) {
    let mut words: Vec<(i64, String)> = Vec::new();
    let mut plain = String::new();
    let mut index = 0usize;
    let chars: Vec<char> = content.chars().collect();
    let mut byte_index = 0usize;
    let _ = &chars;

    while byte_index < content.len() {
        let rest = &content[byte_index..];
        if let Some((time, consumed)) = read_word_tag(rest) {
            let after = byte_index + consumed;
            let next_tag = content[after..]
                .find('<')
                .map(|offset| after + offset)
                .unwrap_or(content.len());
            let text = content[after..next_tag].trim();
            if !text.is_empty() {
                words.push((time, text.to_string()));
                if !plain.is_empty() {
                    plain.push(' ');
                }
                plain.push_str(text);
            }
            byte_index = next_tag;
        } else {
            let ch_len = rest.chars().next().map(|c| c.len_utf8()).unwrap_or(1);
            let ch = &content[byte_index..byte_index + ch_len];
            if ch != "<" {
                plain.push_str(ch);
            }
            byte_index += ch_len;
        }
        index += 1;
        if index > 10_000 {
            break;
        }
    }

    let exact = !words.is_empty();
    (plain.trim().to_string(), words, exact)
}

/// Scripts written without spaces between words. Splitting these on whitespace
/// leaves a whole line as one "word", so per-word styles have nothing to step
/// through.
pub(crate) fn is_unspaced_script(ch: char) -> bool {
    matches!(
        ch as u32,
        0x0E00..=0x0E7F      // Thai
            | 0x0E80..=0x0EFF      // Lao
            | 0x1000..=0x109F      // Myanmar
            | 0x1780..=0x17FF      // Khmer
            | 0x3040..=0x30FF      // Hiragana and Katakana
            | 0x3400..=0x4DBF      // CJK extension A
            | 0x4E00..=0x9FFF      // CJK unified ideographs
            | 0xF900..=0xFAFF      // CJK compatibility ideographs
            | 0x20000..=0x2FA1F // CJK extensions B–F
    )
}

fn is_cjk_punctuation(ch: char) -> bool {
    matches!(ch as u32, 0x3000..=0x303F | 0xFF01..=0xFF60)
}

fn syllable_count(word: &str) -> usize {
    let mut count = 0;
    let mut previous_vowel = false;
    for ch in word.chars().flat_map(|c| c.to_lowercase()) {
        let vowel = matches!(ch, 'a' | 'e' | 'i' | 'o' | 'u' | 'y');
        if vowel && !previous_vowel {
            count += 1;
        }
        previous_vowel = vowel;
    }
    count.max(1)
}

/// Words for spaced text, single characters for scripts that do not use
/// spaces, so every script gets something to animate through.
fn segments(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut word = String::new();

    for ch in text.chars() {
        if ch.is_whitespace() {
            if !word.is_empty() {
                out.push(std::mem::take(&mut word));
            }
        } else if is_unspaced_script(ch) || is_cjk_punctuation(ch) {
            if !word.is_empty() {
                out.push(std::mem::take(&mut word));
            }
            out.push(ch.to_string());
        } else {
            word.push(ch);
        }
    }

    if !word.is_empty() {
        out.push(word);
    }
    out
}

/// Spreads a line's real duration across its words, weighted by syllables.
/// Only used when the source has no per-word timestamps.
fn split_evenly(text: &str, start_ms: i64, end_ms: i64) -> Vec<LyricWord> {
    let parts = segments(text);
    if parts.is_empty() {
        return Vec::new();
    }

    let weights: Vec<f64> = parts.iter().map(|part| syllable_count(part) as f64).collect();
    let total: f64 = weights.iter().sum();
    let span = (end_ms - start_ms).max(parts.len() as i64 * 120) as f64;

    let mut words = Vec::with_capacity(parts.len());
    let mut cursor = start_ms as f64;
    for (index, part) in parts.iter().enumerate() {
        let share = weights[index] / total * span;
        let start = cursor.round() as i64;
        let end = if index == parts.len() - 1 {
            start_ms + span as i64
        } else {
            (cursor + share).round() as i64
        };
        words.push(LyricWord {
            text: part.clone(),
            start_ms: start,
            end_ms: end.max(start + 60),
        });
        cursor += share;
    }
    words
}

pub fn parse_lrc(raw: &str, source: &str) -> Option<Lyrics> {
    let cleaned = raw.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    if cleaned.trim().is_empty() {
        return None;
    }

    let mut offset_ms: i64 = 0;
    for line in cleaned.lines() {
        let lower = line.trim().to_lowercase();
        if lower.starts_with("[offset:") {
            if let Some(rest) = lower.strip_prefix("[offset:") {
                if let Some(value) = rest.trim_end_matches(']').trim().parse::<i64>().ok() {
                    offset_ms = value;
                }
            }
        }
    }

    struct Raw {
        start_ms: i64,
        text: String,
        words: Vec<(i64, String)>,
        exact: bool,
    }

    let mut raws: Vec<Raw> = Vec::new();
    for line in cleaned.lines() {
        let mut stamps: Vec<i64> = Vec::new();
        let mut cursor = 0usize;

        while cursor < line.len() {
            match read_time_tag(&line[cursor..]) {
                Some((time, consumed)) => {
                    stamps.push(time);
                    cursor += consumed;
                }
                None => break,
            }
        }

        if stamps.is_empty() {
            continue;
        }

        let content = line[cursor..].trim();
        let (text, words, exact) = split_words(content);
        if text.is_empty() {
            continue;
        }

        for stamp in stamps {
            let shift = |time: i64| (time - offset_ms).max(0);
            raws.push(Raw {
                start_ms: shift(stamp),
                text: text.clone(),
                words: words
                    .iter()
                    .map(|(time, word)| (shift(*time), word.clone()))
                    .collect(),
                exact,
            });
        }
    }

    if raws.is_empty() {
        return None;
    }

    raws.sort_by_key(|raw| raw.start_ms);
    raws.dedup_by_key(|raw| raw.start_ms);

    let mut lines: Vec<LyricLine> = Vec::with_capacity(raws.len());
    for index in 0..raws.len() {
        let raw = &raws[index];
        let end_ms = raws
            .get(index + 1)
            .map(|next| next.start_ms)
            .filter(|next| *next > raw.start_ms)
            .unwrap_or(raw.start_ms + 6_000);

        let words = if raw.exact && raw.words.len() > 0 {
            let mut words: Vec<LyricWord> = raw
                .words
                .iter()
                .map(|(start, text)| LyricWord {
                    text: text.clone(),
                    start_ms: (*start).clamp(raw.start_ms, end_ms.max(raw.start_ms + 60)),
                    end_ms: 0,
                })
                .collect();
            for index in 0..words.len() {
                let next = words
                    .get(index + 1)
                    .map(|word| word.start_ms)
                    .unwrap_or(end_ms);
                let start = words[index].start_ms;
                words[index].end_ms = next.max(start + 60);
            }
            words
        } else {
            split_evenly(&raw.text, raw.start_ms, end_ms)
        };

        lines.push(LyricLine {
            start_ms: raw.start_ms,
            end_ms,
            text: raw.text.clone(),
            words,
            exact: raw.exact,
        });
    }

    Some(Lyrics {
        source: source.to_string(),
        lines,
        ..Default::default()
    })
}

// ---------------------------------------------------------------- providers

/// How precise a result's timings are.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Timing {
    WordSynced,
    LineSynced,
    /// Distributed across the track by `auto_timing`, not from the source.
    Estimated,
    Unsynced,
}

impl Timing {
    /// Wording for the status panel: "timed word by word".
    pub fn label(&self) -> &'static str {
        match self {
            Timing::WordSynced => "word by word",
            Timing::LineSynced => "line by line",
            Timing::Estimated => "estimated",
            Timing::Unsynced => "not timed",
        }
    }

    pub fn is_synced(&self) -> bool {
        matches!(
            self,
            Timing::WordSynced | Timing::LineSynced | Timing::Estimated
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderWord {
    pub text: String,
    pub start_ms: Option<u32>,
    pub end_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderLine {
    pub start_ms: Option<u32>,
    pub end_ms: Option<u32>,
    pub text: String,
    pub words: Option<Vec<ProviderWord>>,
}

/// What a provider returns, before it is adapted to the lyric engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResult {
    pub lines: Vec<ProviderLine>,
    pub timing: Timing,
    pub source: String,
    pub source_url: Option<String>,
    pub confidence: f32,
    /// Attribution the source requires, shown verbatim where it fits.
    #[serde(default)]
    pub attribution: Option<String>,
    #[serde(default)]
    pub instrumental: bool,
}

impl LyricsResult {
    /// Adapts a timed result to the engine's format. Unsynced and estimated
    /// results return `None` until `auto_timing` has run.
    pub fn to_engine(&self) -> Option<Lyrics> {
        if self.timing == Timing::Unsynced {
            return None;
        }

        let mut timed: Vec<&ProviderLine> = self
            .lines
            .iter()
            .filter(|line| line.start_ms.is_some() && !line.text.trim().is_empty())
            .collect();
        timed.sort_by_key(|line| line.start_ms.unwrap_or(0));

        if timed.is_empty() {
            return None;
        }

        let mut lines: Vec<LyricLine> = Vec::with_capacity(timed.len());
        for index in 0..timed.len() {
            let line = timed[index];
            let start_ms = line.start_ms.unwrap_or(0) as i64;
            let end_ms = line
                .end_ms
                .map(i64::from)
                .or_else(|| timed.get(index + 1).and_then(|next| next.start_ms).map(i64::from))
                .filter(|end| *end > start_ms)
                .unwrap_or(start_ms + 6_000);

            let exact = self.timing == Timing::WordSynced
                && line
                    .words
                    .as_ref()
                    .map(|words| words.iter().all(|word| word.start_ms.is_some()) && !words.is_empty())
                    .unwrap_or(false);

            let words = if exact {
                let mut words: Vec<LyricWord> = line
                    .words
                    .as_ref()
                    .map(|words| {
                        words
                            .iter()
                            .map(|word| LyricWord {
                                text: word.text.clone(),
                                start_ms: word.start_ms.map(i64::from).unwrap_or(start_ms),
                                end_ms: word.end_ms.map(i64::from).unwrap_or(0),
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                for index in 0..words.len() {
                    let next = words.get(index + 1).map(|word| word.start_ms).unwrap_or(end_ms);
                    let start = words[index].start_ms.clamp(start_ms, end_ms.max(start_ms + 60));
                    words[index].start_ms = start;
                    words[index].end_ms = next.max(start + 60);
                }
                words
            } else {
                split_evenly(&line.text, start_ms, end_ms)
            };

            lines.push(LyricLine {
                start_ms,
                end_ms,
                text: line.text.clone(),
                words,
                exact,
            });
        }

        Some(Lyrics {
            source: self.source.clone(),
            lines,
            attribution: self.attribution.clone(),
            source_url: self.source_url.clone(),
            timing: Some(self.timing),
            confidence: self.confidence,
        })
    }
}

/// Plain lyrics (no timestamps) as a provider result. `auto_timing` gives
/// these their timing later.
pub fn plain_result(raw: &str, source: &str, confidence: f32) -> LyricsResult {
    let lines: Vec<ProviderLine> = raw
        .replace("\r\n", "\n")
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .map(|line| ProviderLine {
            start_ms: None,
            end_ms: None,
            text: line.to_string(),
            words: None,
        })
        .collect();

    LyricsResult {
        lines,
        timing: Timing::Unsynced,
        source: source.to_string(),
        source_url: None,
        confidence,
        attribution: Some(format!("Lyrics from {source}")),
        instrumental: false,
    }
}

#[derive(Debug, Clone, thiserror::Error, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderError {
    #[error("no network connection")]
    Offline,
    #[error("rate limited by the provider")]
    RateLimited { retry_after_ms: u64 },
    #[error("missing API credentials")]
    MissingCredentials,
    #[error("no usable match")]
    NotFound,
    #[error("provider timed out")]
    Timeout,
    #[error("provider restricted the lyrics")]
    Restricted,
    #[error("the song page can only be read after an explicit opt-in")]
    OptInRequired,
    #[error("provider error: {0}")]
    Upstream(String),
}

impl ProviderError {
    /// Whether retrying later could succeed (used before caching a negative).
    pub fn is_transient(&self) -> bool {
        matches!(
            self,
            ProviderError::Offline | ProviderError::Timeout | ProviderError::RateLimited { .. }
        )
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ProviderError::Offline | ProviderError::Timeout | ProviderError::Upstream(_)
        )
    }
}

/// One lyrics source. Adding NetEase or a self-hosted API means adding a file
/// that implements this and registering it in `Pipeline::new`.
#[async_trait]
pub trait LyricsProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    async fn fetch(&self, query: TrackQuery) -> Result<LyricsResult, ProviderError>;

    /// Ranked alternatives for the "Wrong lyrics?" picker.
    async fn candidates(&self, _query: TrackQuery, _limit: usize) -> Vec<matcher::Candidate> {
        Vec::new()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attempt {
    pub provider: String,
    pub outcome: String,
    pub confidence: f32,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineOutcome {
    pub result: Option<LyricsResult>,
    pub attempts: Vec<Attempt>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PipelineConfig {
    /// Provider ids in the user's priority order.
    pub order: Vec<String>,
    /// Provider ids the user left switched on; empty means every provider.
    pub enabled: Vec<String>,
    pub confidence_threshold: f32,
    pub prefer_synced: bool,
    /// Estimate timing for plain lyrics instead of leaving them untimed.
    pub auto_estimate: bool,
    pub timeout_ms: u64,
    pub retries: u32,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            order: vec![
                "local".into(),
                "lrclib".into(),
                "musixmatch".into(),
                "genius".into(),
            ],
            enabled: Vec::new(),
            confidence_threshold: 0.6,
            prefer_synced: true,
            auto_estimate: true,
            timeout_ms: 4_000,
            retries: 1,
        }
    }
}

/// Stable identity for cache lookups.
pub fn cache_key(query: &TrackQuery) -> String {
    format!(
        "{}::{}::{}",
        matcher::normalize(&query.artist),
        matcher::normalize(&query.title),
        (query.duration_ms / 1_000).max(0)
    )
}

pub struct Pipeline {
    providers: Vec<Arc<dyn LyricsProvider>>,
    cache: Arc<cache::Cache>,
    /// Preferences can change while the app runs.
    config: std::sync::RwLock<PipelineConfig>,
}

impl Pipeline {
    pub fn new(
        providers: Vec<Arc<dyn LyricsProvider>>,
        cache: Arc<cache::Cache>,
        config: PipelineConfig,
    ) -> Self {
        Self {
            providers,
            cache,
            config: std::sync::RwLock::new(config),
        }
    }

    pub fn config(&self) -> PipelineConfig {
        self.config
            .read()
            .map(|config| config.clone())
            .unwrap_or_default()
    }

    pub fn set_config(&self, next: PipelineConfig) {
        if let Ok(mut config) = self.config.write() {
            *config = next;
        }
    }

    fn ordered(&self, config: &PipelineConfig) -> Vec<Arc<dyn LyricsProvider>> {
        let mut providers: Vec<Arc<dyn LyricsProvider>> = self
            .providers
            .iter()
            .filter(|provider| {
                config.enabled.is_empty() || config.enabled.iter().any(|id| id == provider.id())
            })
            .cloned()
            .collect();

        providers.sort_by_key(|provider| {
            config
                .order
                .iter()
                .position(|id| id == provider.id())
                .unwrap_or(usize::MAX)
        });
        providers
    }

    /// Queries every enabled provider at once, but only accepts a result once
    /// every provider with a higher priority has finished or timed out.
    pub async fn resolve(&self, query: &TrackQuery) -> PipelineOutcome {
        let key = cache_key(query);

        if let Some(reason) = self.cache.negative(&key) {
            return PipelineOutcome {
                result: None,
                attempts: Vec::new(),
                reason: Some(reason),
            };
        }

        // A file the user dropped in or tap-synced always wins over providers.
        if let Some(path) = self.cache.override_path(&key) {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                if let Some(result) = local::override_result(&raw, &path) {
                    return PipelineOutcome {
                        result: Some(result),
                        attempts: Vec::new(),
                        reason: None,
                    };
                }
            }
        }

        let config = self.config();
        let providers = self.ordered(&config);
        if providers.is_empty() {
            return PipelineOutcome {
                result: None,
                attempts: Vec::new(),
                reason: Some("no lyrics sources are enabled".into()),
            };
        }

        let threshold = config.confidence_threshold;
        let prefer_synced = config.prefer_synced;
        let timeout = Duration::from_millis(config.timeout_ms);
        let retries = config.retries;

        let mut pending = FuturesUnordered::new();
        for (index, provider) in providers.iter().cloned().enumerate() {
            let query = query.clone();
            pending.push(async move {
                let started = Instant::now();
                let outcome = match tokio::time::timeout(
                    timeout,
                    fetch_with_retry(&provider, &query, retries),
                )
                .await
                {
                    Ok(result) => result,
                    Err(_) => Err(ProviderError::Timeout),
                };
                (
                    index,
                    provider.id().to_string(),
                    outcome,
                    started.elapsed().as_millis() as u64,
                )
            });
        }

        let mut completed = vec![false; providers.len()];
        let mut attempts: Vec<Attempt> = Vec::new();
        let mut failures: Vec<ProviderError> = Vec::new();
        let mut best: Option<LyricsResult> = None;
        let mut best_index = usize::MAX;
        let mut fallback: Option<LyricsResult> = None;

        while let Some((index, provider_id, outcome, elapsed_ms)) = pending.next().await {
            completed[index] = true;

            match outcome {
                Ok(result) => {
                    let acceptable = result.confidence >= threshold
                        && (!prefer_synced || result.timing != Timing::Unsynced);

                    attempts.push(Attempt {
                        provider: provider_id,
                        outcome: if acceptable {
                            "ok".to_string()
                        } else {
                            format!(
                                "below confidence threshold ({:.2}) or unsynced",
                                result.confidence
                            )
                        },
                        confidence: result.confidence,
                        elapsed_ms,
                    });

                    if acceptable && (best.is_none() || index < best_index) {
                        best = Some(result);
                        best_index = index;
                    } else if fallback.is_none() {
                        fallback = Some(result);
                    }
                }
                Err(error) => {
                    attempts.push(Attempt {
                        provider: provider_id,
                        outcome: error.to_string(),
                        confidence: 0.0,
                        elapsed_ms,
                    });
                    failures.push(error);
                }
            }

            if best.is_some() && completed[..best_index].iter().all(|done| *done) {
                break;
            }
        }

        if best.is_none() && fallback.is_none() {
            let transient = failures.iter().any(ProviderError::is_transient);
            let reason = describe_failure(&attempts);

            if !transient {
                self.cache.put_negative(&key, &reason);
            }

            return PipelineOutcome {
                result: None,
                attempts,
                reason: Some(reason),
            };
        }

        let mut result = best.or(fallback).expect("checked above");
        if config.auto_estimate {
            auto_timing::apply(&mut result, query.duration_ms);
        }
        self.cache.put_positive(&key, &result);

        PipelineOutcome {
            result: Some(result),
            attempts,
            reason: None,
        }
    }
}

async fn fetch_with_retry(
    provider: &Arc<dyn LyricsProvider>,
    query: &TrackQuery,
    retries: u32,
) -> Result<LyricsResult, ProviderError> {
    let mut attempt = 0;
    loop {
        match provider.fetch(query.clone()).await {
            Ok(result) => return Ok(result),
            Err(error) if error.is_retryable() && attempt < retries => {
                attempt += 1;
                tokio::time::sleep(Duration::from_millis(250 * 2u64.pow(attempt - 1))).await;
            }
            Err(error) => return Err(error),
        }
    }
}

fn describe_failure(attempts: &[Attempt]) -> String {
    if attempts.is_empty() {
        return "no lyrics sources are enabled".into();
    }
    let detail = attempts
        .iter()
        .map(|attempt| format!("{}: {}", attempt.provider, attempt.outcome))
        .collect::<Vec<_>>()
        .join("; ");
    format!("no lyrics found ({detail})")
}

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------ LRC parser

    #[test]
    fn parses_line_synced_lrc() {
        let raw = "[00:12.34]first line\n[00:15.00]second line\n";
        let lyrics = parse_lrc(raw, "test").expect("parsed");
        assert_eq!(lyrics.lines.len(), 2);
        assert_eq!(lyrics.lines[0].start_ms, 12_340);
        assert_eq!(lyrics.lines[1].start_ms, 15_000);
        assert!(!lyrics.lines[0].exact);
        // Plain LRC still gets word timings, split by syllables.
        assert_eq!(lyrics.lines[0].words.len(), 2);
    }

    #[test]
    fn parses_enhanced_lrc_word_timings() {
        let raw = "[00:10.00]<00:10.00>Hello <00:10.60>world\n";
        let lyrics = parse_lrc(raw, "test").expect("parsed");
        assert_eq!(lyrics.lines[0].text, "Hello world");
        assert!(lyrics.lines[0].exact);
        assert_eq!(lyrics.lines[0].words[0].start_ms, 10_000);
        assert_eq!(lyrics.lines[0].words[1].start_ms, 10_600);
    }

    #[test]
    fn applies_offset_and_multiple_stamps() {
        let raw = "[offset:500]\n[00:10.00][00:20.00]chorus\n";
        let lyrics = parse_lrc(raw, "test").expect("parsed");
        assert_eq!(lyrics.lines.len(), 2);
        assert_eq!(lyrics.lines[0].start_ms, 9_500);
        assert_eq!(lyrics.lines[1].start_ms, 19_500);
    }

    #[test]
    fn rejects_empty_or_untimed_input() {
        assert!(parse_lrc("   ", "test").is_none());
        assert!(parse_lrc("just words, no tags", "test").is_none());
    }

    #[test]
    fn word_split_weights_longer_words() {
        let words = split_evenly("oh magnificent", 0, 1_000);
        assert_eq!(words.len(), 2);
        let first = words[0].end_ms - words[0].start_ms;
        let second = words[1].end_ms - words[1].start_ms;
        assert!(second > first, "{second} should exceed {first}");
        assert!(words.windows(2).all(|pair| pair[0].end_ms <= pair[1].start_ms + 60));
    }

    // ------------------------------------------------------------- pipeline

    struct MockProvider {
        id: &'static str,
        delay: Duration,
        outcome: MockOutcome,
    }

    enum MockOutcome {
        Ok { confidence: f32, timing: Timing },
        Fail(ProviderError),
    }

    #[async_trait]
    impl LyricsProvider for MockProvider {
        fn id(&self) -> &'static str {
            self.id
        }

        fn name(&self) -> &'static str {
            self.id
        }

        async fn fetch(&self, _query: TrackQuery) -> Result<LyricsResult, ProviderError> {
            tokio::time::sleep(self.delay).await;
            match &self.outcome {
                MockOutcome::Ok { confidence, timing } => Ok(LyricsResult {
                    lines: vec![ProviderLine {
                        start_ms: Some(0),
                        end_ms: Some(1_000),
                        text: "invented line".into(),
                        words: None,
                    }],
                    timing: *timing,
                    source: self.id.to_string(),
                    source_url: None,
                    confidence: *confidence,
                    attribution: None,
                    instrumental: false,
                }),
                MockOutcome::Fail(error) => Err(error.clone()),
            }
        }
    }

    fn mock(
        id: &'static str,
        delay_ms: u64,
        outcome: MockOutcome,
    ) -> Arc<dyn LyricsProvider> {
        Arc::new(MockProvider {
            id,
            delay: Duration::from_millis(delay_ms),
            outcome,
        })
    }

    fn query() -> TrackQuery {
        TrackQuery {
            title: "Invented Song".into(),
            artist: "Invented Artist".into(),
            album: String::new(),
            duration_ms: 200_000,
        }
    }

    fn pipeline(
        providers: Vec<Arc<dyn LyricsProvider>>,
        config: PipelineConfig,
    ) -> Pipeline {
        Pipeline::new(providers, Arc::new(cache::Cache::in_memory()), config)
    }

    #[tokio::test]
    async fn higher_priority_wins_even_if_slower() {
        let providers = vec![
            mock("slow", 80, MockOutcome::Ok { confidence: 0.9, timing: Timing::LineSynced }),
            mock("fast", 0, MockOutcome::Ok { confidence: 0.9, timing: Timing::LineSynced }),
        ];
        let config = PipelineConfig {
            order: vec!["slow".into(), "fast".into()],
            ..Default::default()
        };

        let outcome = pipeline(providers, config).resolve(&query()).await;
        assert_eq!(outcome.result.expect("result").source, "slow");
    }

    #[tokio::test]
    async fn low_confidence_falls_through_to_next_provider() {
        let providers = vec![
            mock("weak", 0, MockOutcome::Ok { confidence: 0.2, timing: Timing::LineSynced }),
            mock("strong", 5, MockOutcome::Ok { confidence: 0.95, timing: Timing::LineSynced }),
        ];
        let config = PipelineConfig {
            order: vec!["weak".into(), "strong".into()],
            ..Default::default()
        };

        let outcome = pipeline(providers, config).resolve(&query()).await;
        assert_eq!(outcome.result.expect("result").source, "strong");
        assert!(outcome.attempts.iter().any(|attempt| attempt.provider == "weak"
            && attempt.outcome.contains("threshold")));
    }

    #[tokio::test]
    async fn slow_provider_times_out_and_next_wins() {
        let providers = vec![
            mock("stuck", 500, MockOutcome::Ok { confidence: 0.9, timing: Timing::LineSynced }),
            mock("quick", 0, MockOutcome::Ok { confidence: 0.9, timing: Timing::LineSynced }),
        ];
        let config = PipelineConfig {
            order: vec!["stuck".into(), "quick".into()],
            timeout_ms: 80,
            ..Default::default()
        };

        let outcome = pipeline(providers, config).resolve(&query()).await;
        assert_eq!(outcome.result.expect("result").source, "quick");
        assert!(outcome
            .attempts
            .iter()
            .any(|attempt| attempt.provider == "stuck" && attempt.outcome.contains("timed out")));
    }

    #[tokio::test]
    async fn prefer_synced_skips_a_plain_result() {
        let providers = vec![
            mock("plain", 0, MockOutcome::Ok { confidence: 0.99, timing: Timing::Unsynced }),
            mock("timed", 5, MockOutcome::Ok { confidence: 0.8, timing: Timing::LineSynced }),
        ];
        let config = PipelineConfig {
            order: vec!["plain".into(), "timed".into()],
            prefer_synced: true,
            ..Default::default()
        };

        let outcome = pipeline(providers, config).resolve(&query()).await;
        assert_eq!(outcome.result.expect("result").source, "timed");
    }

    #[tokio::test]
    async fn unsynced_result_is_kept_when_estimation_is_off() {
        let providers = vec![mock(
            "plain",
            0,
            MockOutcome::Ok { confidence: 0.9, timing: Timing::Unsynced },
        )];
        let config = PipelineConfig {
            order: vec!["plain".into()],
            auto_estimate: false,
            ..Default::default()
        };

        let outcome = pipeline(providers, config).resolve(&query()).await;
        let result = outcome.result.expect("unsynced fallback is still a result");
        assert_eq!(result.timing, Timing::Unsynced);
    }

    #[tokio::test]
    async fn plain_results_get_estimated_timing() {
        let providers = vec![mock(
            "plain",
            0,
            MockOutcome::Ok { confidence: 0.9, timing: Timing::Unsynced },
        )];
        let config = PipelineConfig {
            order: vec!["plain".into()],
            auto_estimate: true,
            ..Default::default()
        };

        let outcome = pipeline(providers, config).resolve(&query()).await;
        let result = outcome.result.expect("estimated result");
        assert_eq!(result.timing, Timing::Estimated);
        assert!(result.lines[0].start_ms.is_some());
        assert!(
            result.to_engine().is_some(),
            "estimated lyrics must reach the engine"
        );
    }

    #[tokio::test]
    async fn misses_are_negatively_cached_for_a_day() {
        let providers: Vec<Arc<dyn LyricsProvider>> = vec![mock(
            "empty",
            0,
            MockOutcome::Fail(ProviderError::NotFound),
        )];
        let config = PipelineConfig {
            order: vec!["empty".into()],
            ..Default::default()
        };
        let pipeline = pipeline(providers, config);

        let first = pipeline.resolve(&query()).await;
        assert!(first.result.is_none());
        assert!(first.reason.expect("reason").contains("empty"));

        // Second call is answered from the negative cache: no attempts run.
        let second = pipeline.resolve(&query()).await;
        assert!(second.attempts.is_empty());
        assert!(second.result.is_none());
    }

    #[tokio::test]
    async fn transient_failures_are_not_negatively_cached() {
        let providers: Vec<Arc<dyn LyricsProvider>> = vec![mock(
            "offline",
            0,
            MockOutcome::Fail(ProviderError::Offline),
        )];
        let config = PipelineConfig {
            order: vec!["offline".into()],
            retries: 0,
            ..Default::default()
        };
        let pipeline = pipeline(providers, config);

        assert!(pipeline.resolve(&query()).await.result.is_none());
        let second = pipeline.resolve(&query()).await;
        assert!(
            !second.attempts.is_empty(),
            "an offline provider must be retried, not cached"
        );
    }

    #[test]
    fn scripts_without_spaces_are_split_per_character() {
        let words = split_evenly("日本語の歌", 0, 3_000);
        assert_eq!(words.len(), 5);
        assert_eq!(words[0].text, "日");
        assert!(words.windows(2).all(|pair| pair[0].start_ms < pair[1].start_ms));
        assert_eq!(words[4].end_ms, 3_000);
    }

    #[test]
    fn spaced_scripts_keep_their_words() {
        let words = split_evenly("the city hums", 0, 3_000);
        assert_eq!(words.len(), 3);
        assert_eq!(words[2].text, "hums");
    }

    #[test]
    fn mixed_lines_split_on_both_rules() {
        let words = split_evenly("hello 世界", 0, 2_000);
        let texts: Vec<&str> = words.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, ["hello", "世", "界"]);
    }

    #[tokio::test]
    async fn a_user_override_beats_every_provider() {
        let path = std::env::temp_dir().join(format!(
            "lyrica-override-test-{}.lrc",
            std::process::id()
        ));
        std::fs::write(&path, "[00:01.00]invented one\n[00:03.00]invented two\n")
            .expect("write override");

        let cache = Arc::new(cache::Cache::in_memory());
        cache.set_override(&cache_key(&query()), &path.to_string_lossy());

        let providers = vec![mock(
            "provider",
            0,
            MockOutcome::Ok { confidence: 0.99, timing: Timing::LineSynced },
        )];
        let pipeline = Pipeline::new(
            providers,
            cache,
            PipelineConfig {
                order: vec!["provider".into()],
                ..Default::default()
            },
        );

        let outcome = pipeline.resolve(&query()).await;
        let result = outcome.result.expect("override result");
        assert_eq!(result.source, "Local file");
        assert_eq!(result.lines.len(), 2);
        assert_eq!(result.lines[0].start_ms, Some(1_000));

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn successful_results_are_cached() {
        let providers: Vec<Arc<dyn LyricsProvider>> = vec![mock(
            "good",
            0,
            MockOutcome::Ok { confidence: 0.9, timing: Timing::LineSynced },
        )];
        let config = PipelineConfig {
            order: vec!["good".into()],
            ..Default::default()
        };
        let pipeline = pipeline(providers, config);

        assert!(pipeline.resolve(&query()).await.result.is_some());
        let cached = pipeline.cache.positive(&cache_key(&query()), cache::DEFAULT_TTL_MS);
        assert_eq!(cached.expect("cached").source, "good");
    }

    // ------------------------------------------------------- engine adapter

    #[test]
    fn engine_adapter_keeps_word_timings() {
        let result = LyricsResult {
            lines: vec![ProviderLine {
                start_ms: Some(1_000),
                end_ms: Some(2_000),
                text: "hello world".into(),
                words: Some(vec![
                    ProviderWord { text: "hello".into(), start_ms: Some(1_000), end_ms: Some(1_400) },
                    ProviderWord { text: "world".into(), start_ms: Some(1_400), end_ms: Some(2_000) },
                ]),
            }],
            timing: Timing::WordSynced,
            source: "test".into(),
            source_url: None,
            confidence: 1.0,
            attribution: None,
            instrumental: false,
        };

        let engine = result.to_engine().expect("converted");
        assert_eq!(engine.lines[0].words[1].start_ms, 1_400);
        assert!(engine.lines[0].exact);
    }

    #[test]
    fn engine_adapter_refuses_unsynced_results() {
        let result = LyricsResult {
            lines: vec![ProviderLine {
                start_ms: None,
                end_ms: None,
                text: "plain".into(),
                words: None,
            }],
            timing: Timing::Unsynced,
            source: "genius".into(),
            source_url: None,
            confidence: 0.8,
            attribution: None,
            instrumental: false,
        };
        assert!(result.to_engine().is_none());
    }

    #[test]
    fn engine_adapter_derives_end_times_from_the_next_line() {
        let line = |start: u32, text: &str| ProviderLine {
            start_ms: Some(start),
            end_ms: None,
            text: text.into(),
            words: None,
        };
        let result = LyricsResult {
            lines: vec![line(0, "one"), line(3_000, "two")],
            timing: Timing::LineSynced,
            source: "test".into(),
            source_url: None,
            confidence: 1.0,
            attribution: None,
            instrumental: false,
        };

        let engine = result.to_engine().expect("converted");
        assert_eq!(engine.lines[0].end_ms, 3_000);
        assert!(!engine.lines[0].words.is_empty());
    }
}
