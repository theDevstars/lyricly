//! Genius: the official `/search` API ranks candidates; the lyrics text itself
//! only comes from reading the song page, which is opt-in because it goes
//! against Genius' terms of service and may break at any time.

use crate::lyrics::{
    matcher, LyricsProvider, LyricsResult, ProviderError, ProviderLine, Timing, TrackQuery,
};
use async_trait::async_trait;
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const SEARCH: &str = "https://api.genius.com/search";
const USER_AGENT: &str =
    "Lyrica/0.1 (Windows tray lyric player; +https://github.com/theDevstars/lyricly)";
/// One song-page request per second, as required of polite scrapers.
const PAGE_INTERVAL: Duration = Duration::from_millis(1_000);

pub struct GeniusProvider {
    token: Option<String>,
    page_parsing: Arc<AtomicBool>,
    client: reqwest::Client,
    last_page: Mutex<Option<Instant>>,
}

impl GeniusProvider {
    pub fn new(token: Option<String>, page_parsing: Arc<AtomicBool>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .user_agent(USER_AGENT)
            .build()
            .unwrap_or_default();

        Self {
            token,
            page_parsing,
            client,
            last_page: Mutex::new(None),
        }
    }

    async fn search(&self, token: &str, query: &TrackQuery) -> Result<Vec<HitResult>, ProviderError> {
        let q = format!("{} {}", query.title, query.artist);
        let response = self
            .client
            .get(SEARCH)
            .query(&[("q", q.trim())])
            .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
            .send()
            .await
            .map_err(map_request_error)?;

        match response.status() {
            status if status.is_success() => {}
            reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
                return Err(ProviderError::MissingCredentials)
            }
            reqwest::StatusCode::TOO_MANY_REQUESTS => {
                return Err(ProviderError::RateLimited {
                    retry_after_ms: retry_after_ms(&response),
                })
            }
            status => return Err(ProviderError::Upstream(format!("search returned {status}"))),
        }

        let body = response
            .json::<SearchResponse>()
            .await
            .map_err(|error| ProviderError::Upstream(error.to_string()))?;

        Ok(body.response.hits.into_iter().map(|hit| hit.result).collect())
    }

    async fn wait_for_page_slot(&self) {
        let mut last = self.last_page.lock().await;
        if let Some(previous) = *last {
            let elapsed = previous.elapsed();
            if elapsed < PAGE_INTERVAL {
                tokio::time::sleep(PAGE_INTERVAL - elapsed).await;
            }
        }
        *last = Some(Instant::now());
    }

    async fn page(&self, url: &str) -> Result<String, ProviderError> {
        let response = self
            .client
            .get(url)
            .header(reqwest::header::USER_AGENT, USER_AGENT)
            .send()
            .await
            .map_err(map_request_error)?;

        if !response.status().is_success() {
            return Err(ProviderError::Upstream(format!(
                "song page returned {}",
                response.status()
            )));
        }
        response
            .text()
            .await
            .map_err(|error| ProviderError::Upstream(error.to_string()))
    }
}

#[async_trait]
impl LyricsProvider for GeniusProvider {
    fn id(&self) -> &'static str {
        "genius"
    }

    fn name(&self) -> &'static str {
        "Genius"
    }

    async fn fetch(&self, query: TrackQuery) -> Result<LyricsResult, ProviderError> {
        let token = self.token.as_deref().ok_or(ProviderError::MissingCredentials)?;

        let hits = self.search(token, &query).await?;
        let (confidence, hit) = rank(&hits, &query).ok_or(ProviderError::NotFound)?;

        // The API only locates the song; the text lives on the page.
        if !self.page_parsing.load(Ordering::Relaxed) {
            return Err(ProviderError::OptInRequired);
        }

        self.wait_for_page_slot().await;
        let html = self.page(&hit.url).await?;
        let parsed = parse_lyrics_page(&html);

        if parsed.lines.is_empty() {
            return Err(ProviderError::NotFound);
        }

        Ok(LyricsResult {
            lines: parsed
                .lines
                .iter()
                .map(|line| ProviderLine {
                    start_ms: None,
                    end_ms: None,
                    text: line.clone(),
                    words: None,
                })
                .collect(),
            timing: Timing::Unsynced,
            source: "Genius".into(),
            source_url: Some(hit.url.clone()),
            confidence,
            attribution: Some("Lyrics from Genius".into()),
            instrumental: false,
        })
    }
}

fn rank<'a>(hits: &'a [HitResult], query: &TrackQuery) -> Option<(f32, &'a HitResult)> {
    hits.iter()
        .map(|hit| {
            let candidate = matcher::Candidate {
                title: hit.title.clone(),
                artist: hit
                    .primary_artist
                    .as_ref()
                    .map(|artist| artist.name.clone())
                    .unwrap_or_default(),
                album: None,
                duration_ms: None,
                flags: Vec::new(),
            };
            (matcher::score(query, &candidate), hit)
        })
        .filter(|(score, _)| *score >= 0.5)
        .max_by(|left, right| {
            left.0
                .partial_cmp(&right.0)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
}

fn retry_after_ms(response: &reqwest::Response) -> u64 {
    response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|seconds| seconds * 1_000)
        .unwrap_or(5_000)
}

fn map_request_error(error: reqwest::Error) -> ProviderError {
    if error.is_connect() {
        ProviderError::Offline
    } else if error.is_timeout() {
        ProviderError::Timeout
    } else {
        ProviderError::Upstream(error.to_string())
    }
}

// ---------------------------------------------------------------- page parse

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SectionLabel {
    pub text: String,
    /// How many lyric lines precede this label.
    pub before_line: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ParsedLyrics {
    pub lines: Vec<String>,
    pub sections: Vec<SectionLabel>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Frame {
    Lyrics,
    Skip,
    Other,
}

const NOISE_LINES: &[&str] = &[
    "embed",
    "you might also like",
    "read more",
    "show more",
    "advertisement",
    "lyrics",
];

const EXCLUDED_MARKERS: &[&str] = &[
    "data-exclude-from-selection",
    "lyricsheader",
    "lyricsfooter",
    "contributors",
    "rightsidebar",
    "embeddedcontent",
    "lyricsteaser",
    "adunit",
];

/// Reads Genius' `[data-lyrics-container]` blocks, turning `<br>` into line
/// breaks and dropping page chrome. Section labels are returned separately.
pub fn parse_lyrics_page(html: &str) -> ParsedLyrics {
    let mut text = String::new();
    let mut stack: Vec<Frame> = Vec::new();
    let mut index = 0usize;

    while index < html.len() {
        if html[index..].starts_with("<!--") {
            match html[index..].find("-->") {
                Some(offset) => index += offset + 3,
                None => break,
            }
            continue;
        }

        if html.as_bytes()[index] == b'<' {
            let Some(end) = html[index..].find('>') else {
                break;
            };
            let tag = html[index + 1..index + end].trim().to_string();
            index += end + 1;

            let inside_lyrics = stack.contains(&Frame::Lyrics);
            let skipping = stack.contains(&Frame::Skip);

            if let Some(closing) = tag.strip_prefix('/') {
                let name = closing.trim().to_ascii_lowercase();
                if !is_void(&name) {
                    // A closed lyrics block ends its last line, so the next
                    // block does not run into it.
                    if stack.pop() == Some(Frame::Lyrics) {
                        text.push('\n');
                    }
                }
                continue;
            }

            let name: String = tag
                .chars()
                .take_while(|ch| ch.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_lowercase();
            let attributes = tag.to_ascii_lowercase();
            let self_closing = tag.ends_with('/');

            if name == "br" {
                if inside_lyrics && !skipping {
                    text.push('\n');
                }
                continue;
            }

            if self_closing || is_void(&name) {
                continue;
            }

            let frame = if attributes.contains("data-lyrics-container") {
                Frame::Lyrics
            } else if matches!(name.as_str(), "script" | "style" | "noscript") {
                Frame::Skip
            } else if inside_lyrics
                && EXCLUDED_MARKERS
                    .iter()
                    .any(|marker| attributes.contains(marker))
            {
                Frame::Skip
            } else {
                Frame::Other
            };
            stack.push(frame);
            continue;
        }

        let next = html[index..]
            .find('<')
            .map(|offset| index + offset)
            .unwrap_or(html.len());
        let chunk = &html[index..next];
        index = next;

        if stack.contains(&Frame::Lyrics) && !stack.contains(&Frame::Skip) {
            text.push_str(&decode_entities(chunk));
        }
    }

    extract_lines(&text)
}

fn is_void(name: &str) -> bool {
    matches!(
        name,
        "br" | "img" | "hr" | "meta" | "link" | "input" | "source" | "wbr"
    )
}

fn extract_lines(text: &str) -> ParsedLyrics {
    let mut lines: Vec<String> = Vec::new();
    let mut sections: Vec<SectionLabel> = Vec::new();

    for raw in text.split('\n') {
        let line = raw.split_whitespace().collect::<Vec<_>>().join(" ");
        if line.is_empty() {
            continue;
        }

        let lower = line.to_lowercase();
        if NOISE_LINES.contains(&lower.as_str()) {
            continue;
        }

        if line.starts_with('[') && line.ends_with(']') {
            sections.push(SectionLabel {
                text: line,
                before_line: lines.len(),
            });
            continue;
        }

        if lines.last() == Some(&line) {
            continue;
        }
        lines.push(line);
    }

    ParsedLyrics { lines, sections }
}

fn decode_entities(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;

    while let Some(start) = rest.find('&') {
        out.push_str(&rest[..start]);
        let after = &rest[start..];

        let Some(end) = after.find(';').filter(|end| *end <= 10) else {
            out.push('&');
            rest = &after[1..];
            continue;
        };

        let entity = &after[1..end];
        let decoded = match entity {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "nbsp" => Some(' '),
            _ => {
                if let Some(hex) = entity.strip_prefix("#x").or_else(|| entity.strip_prefix("#X")) {
                    u32::from_str_radix(hex, 16).ok().and_then(char::from_u32)
                } else {
                    entity
                        .strip_prefix('#')
                        .and_then(|digits| digits.parse::<u32>().ok())
                        .and_then(char::from_u32)
                }
            }
        };

        match decoded {
            Some(ch) => out.push(ch),
            None => out.push_str(&after[..=end]),
        }
        rest = &after[end + 1..];
    }

    out.push_str(rest);
    out
}

// ------------------------------------------------------------------- payload

#[derive(Debug, Deserialize)]
struct SearchResponse {
    response: SearchBody,
}

#[derive(Debug, Deserialize)]
struct SearchBody {
    hits: Vec<Hit>,
}

#[derive(Debug, Deserialize)]
struct Hit {
    result: HitResult,
}

#[derive(Debug, Deserialize)]
struct HitResult {
    title: String,
    url: String,
    #[serde(default)]
    primary_artist: Option<Artist>,
}

#[derive(Debug, Deserialize)]
struct Artist {
    name: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../tests/fixtures/genius_page.html");

    #[test]
    fn extracts_only_lyric_lines() {
        let parsed = parse_lyrics_page(FIXTURE);
        assert_eq!(parsed.lines.len(), 9, "lines: {:#?}", parsed.lines);
        assert_eq!(parsed.lines[0], "Paper lanterns on the wire");
        assert_eq!(parsed.lines[1], "counting seconds in the rain");
        assert_eq!(parsed.lines[8], "still the kettle keeps its hum");
    }

    #[test]
    fn drops_page_chrome_and_excluded_blocks() {
        let parsed = parse_lyrics_page(FIXTURE);
        let joined = parsed.lines.join("\n").to_lowercase();
        for unwanted in ["contributor", "translation", "embed", "you might also like"] {
            assert!(!joined.contains(unwanted), "{unwanted} leaked into the lyrics");
        }
    }

    #[test]
    fn keeps_section_labels_as_metadata() {
        let parsed = parse_lyrics_page(FIXTURE);
        let labels: Vec<&str> = parsed.sections.iter().map(|s| s.text.as_str()).collect();
        assert_eq!(
            labels,
            vec!["[Verse 1: Invented Singer]", "[Chorus]", "[Verse 2: Invented Singer]"]
        );
        assert_eq!(parsed.sections[0].before_line, 0);
        assert_eq!(parsed.sections[1].before_line, 3);
        assert_eq!(parsed.sections[2].before_line, 6);
        assert!(!parsed.lines.iter().any(|line| line.starts_with('[')));
    }

    #[test]
    fn converts_br_tags_to_line_breaks() {
        let html = r#"<div data-lyrics-container="true">alpha<br>beta<br/>gamma</div>"#;
        let parsed = parse_lyrics_page(html);
        assert_eq!(parsed.lines, vec!["alpha", "beta", "gamma"]);
    }

    #[test]
    fn ignores_text_outside_lyrics_containers() {
        let html = r#"<div class="Share">Share this song</div>
            <div data-lyrics-container="true">inside the box</div>
            <p>after the box</p>"#;
        assert_eq!(parse_lyrics_page(html).lines, vec!["inside the box"]);
    }

    #[test]
    fn joins_multiple_containers_in_order() {
        let html = r#"
            <div data-lyrics-container="true">first<br>second</div>
            <div data-lyrics-container="true">third<br>fourth</div>"#;
        assert_eq!(
            parse_lyrics_page(html).lines,
            vec!["first", "second", "third", "fourth"]
        );
    }

    #[test]
    fn decodes_entities_and_drops_comments() {
        let html = r#"<div data-lyrics-container="true"><!-- note -->don&#39;t &amp; won&nbsp;it</div>"#;
        assert_eq!(parse_lyrics_page(html).lines, vec!["don't & won it"]);
    }

    #[test]
    fn collapses_repeated_lines_and_whitespace() {
        let html = r#"<div data-lyrics-container="true">same   line<br>same   line<br><br>next</div>"#;
        assert_eq!(parse_lyrics_page(html).lines, vec!["same line", "next"]);
    }

    #[test]
    fn ranking_prefers_the_real_song_over_a_cover() {
        let hits = vec![
            HitResult {
                title: "Tiny Dancer (Cover)".into(),
                url: "https://genius.com/cover".into(),
                primary_artist: Some(Artist { name: "Some Cover Band".into() }),
            },
            HitResult {
                title: "Tiny Dancer".into(),
                url: "https://genius.com/elton-john-tiny-dancer-lyrics".into(),
                primary_artist: Some(Artist { name: "Elton John".into() }),
            },
        ];
        let query = TrackQuery {
            title: "Tiny Dancer".into(),
            artist: "Elton John".into(),
            album: String::new(),
            duration_ms: 0,
        };

        let (confidence, hit) = rank(&hits, &query).expect("a ranked hit");
        assert!(hit.url.contains("elton-john"));
        assert!(confidence > 0.6, "confidence {confidence}");
    }

    #[test]
    fn ranking_gives_up_on_unrelated_hits() {
        let hits = vec![HitResult {
            title: "Completely Different Song".into(),
            url: "https://genius.com/other".into(),
            primary_artist: Some(Artist { name: "Someone Else".into() }),
        }];
        let query = TrackQuery {
            title: "Tiny Dancer".into(),
            artist: "Elton John".into(),
            album: String::new(),
            duration_ms: 0,
        };
        assert!(rank(&hits, &query).is_none());
    }
}
