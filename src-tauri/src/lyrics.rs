//! Timed lyrics: enhanced LRC parsing (per-word tags when present), a syllable
//! based split for plain LRC, and LRCLIB lookups.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lyrics {
    pub source: String,
    pub lines: Vec<LyricLine>,
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

/// Spreads a line's real duration across its words, weighted by syllables.
/// Only used when the source has no per-word timestamps.
fn split_evenly(text: &str, start_ms: i64, end_ms: i64) -> Vec<LyricWord> {
    let parts: Vec<&str> = text.split_whitespace().collect();
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
            text: (*part).to_string(),
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
    })
}

#[derive(Debug, Deserialize)]
struct LrclibRecord {
    #[serde(rename = "trackName")]
    track_name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    duration: Option<f64>,
    instrumental: Option<bool>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
}

fn normalize(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn score(record: &LrclibRecord, title: &str, artist: &str, duration_s: Option<i64>) -> f64 {
    if record.synced_lyrics.is_none() {
        return -1.0;
    }
    let mut score = 100.0;
    if let Some(name) = &record.track_name {
        if normalize(name) == normalize(title) {
            score += 30.0;
        } else if normalize(name).contains(&normalize(title)) {
            score += 10.0;
        }
    }
    if let Some(name) = &record.artist_name {
        if normalize(name) == normalize(artist) {
            score += 20.0;
        } else if normalize(name).contains(&normalize(artist)) {
            score += 8.0;
        }
    }
    if let (Some(record_duration), Some(track_duration)) = (record.duration, duration_s) {
        score -= ((record_duration - track_duration as f64).abs() / 2.0).min(60.0);
    }
    if record.instrumental.unwrap_or(false) {
        score -= 50.0;
    }
    score
}

pub struct TrackQuery {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
}

/// Looks a track up on LRCLIB. Blocking on purpose: it runs on a worker thread.
pub fn fetch_from_lrclib(query: &TrackQuery) -> Result<Lyrics, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Lyrica/0.1 (Windows tray lyric player)")
        .build()
        .map_err(|error| error.to_string())?;

    let duration_s = (query.duration_ms > 0).then(|| (query.duration_ms as f64 / 1000.0).round() as i64);

    let mut params: HashMap<&str, String> = HashMap::new();
    params.insert("track_name", query.title.clone());
    params.insert("artist_name", query.artist.clone());
    if !query.album.is_empty() {
        params.insert("album_name", query.album.clone());
    }
    if let Some(duration) = duration_s {
        params.insert("duration", duration.to_string());
    }

    let response = client
        .get("https://lrclib.net/api/get")
        .query(&params)
        .send()
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        if let Ok(record) = response.json::<LrclibRecord>() {
            if let Some(synced) = record.synced_lyrics {
                if let Some(lyrics) = parse_lrc(&synced, "LRCLIB") {
                    return Ok(lyrics);
                }
            }
        }
    }

    let mut search: HashMap<&str, String> = HashMap::new();
    search.insert("track_name", query.title.clone());
    search.insert("artist_name", query.artist.clone());

    let results = client
        .get("https://lrclib.net/api/search")
        .query(&search)
        .send()
        .map_err(|error| error.to_string())?
        .json::<Vec<LrclibRecord>>()
        .map_err(|error| error.to_string())?;

    let best = results
        .iter()
        .filter_map(|record| {
            let value = score(record, &query.title, &query.artist, duration_s);
            (value > 0.0).then_some((value, record))
        })
        .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(_, record)| record)
        .ok_or_else(|| "no synced lyrics found".to_string())?;

    let synced = best
        .synced_lyrics
        .as_ref()
        .ok_or_else(|| "no synced lyrics found".to_string())?;

    parse_lrc(synced, "LRCLIB").ok_or_else(|| "lyrics could not be parsed".to_string())
}
