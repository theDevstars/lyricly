//! Pure matching helpers: query normalization, fuzzy similarity, and candidate
//! scoring. No I/O, no async, fully unit tested.

use crate::lyrics::TrackQuery;
use std::collections::HashMap;

/// Phrases that mark a version rather than the song itself.
const VERSION_MARKERS: &[&str] = &[
    "remaster",
    "remastered",
    "single version",
    "album version",
    "radio edit",
    "radio version",
    "live",
    "acoustic",
    "demo",
    "mono",
    "stereo",
    "deluxe",
    "explicit",
    "clean version",
    "instrumental",
    "karaoke",
    "re-recorded",
    "anniversary",
    "expanded",
    "bonus track",
    "motion picture",
    "soundtrack",
    "sped up",
    "slowed",
    "nightcore",
    "taylor's version",
    "feat",
    "ft.",
    "featuring",
    "produced by",
    "prod.",
];

/// Score penalties applied when a candidate is a substitute rather than the record.
const PENALTIES: &[(&str, f32)] = &[
    ("karaoke", 0.45),
    ("made famous", 0.4),
    ("in the style of", 0.45),
    ("parody", 0.5),
    ("tribute", 0.4),
    ("cover", 0.35),
    ("translation", 0.5),
    ("translated", 0.5),
    ("nightcore", 0.4),
    ("instrumental", 0.3),
    ("sped up", 0.3),
    ("slowed", 0.25),
    ("live", 0.2),
    ("remix", 0.15),
];

/// A search hit from any provider, reduced to what scoring needs.
#[derive(Debug, Clone, Default)]
pub struct Candidate {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    /// Extra signals supplied by the provider, e.g. `karaoke`, `translation`.
    pub flags: Vec<String>,
}

/// Lowercase, strip punctuation and collapse whitespace. Keeps letters from any
/// script, so Cyrillic, CJK and Arabic titles normalize rather than vanish.
pub fn normalize(input: &str) -> String {
    input
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn contains_marker(text: &str) -> bool {
    let lower = text.to_lowercase();
    VERSION_MARKERS.iter().any(|marker| lower.contains(marker))
}

/// Drops `(feat. X)`, `[Live]`, `(Remastered 2011)` and friends, but keeps
/// parenthetical text that is part of the title.
fn strip_bracketed(input: &str) -> String {
    let mut out = String::new();
    let mut depth = 0usize;
    let mut buffer = String::new();

    for ch in input.chars() {
        match ch {
            '(' | '[' | '{' => {
                depth += 1;
                buffer.clear();
            }
            ')' | ']' | '}' => {
                if depth > 0 {
                    depth -= 1;
                    if depth == 0 {
                        if !buffer.trim().is_empty() && !contains_marker(&buffer) {
                            out.push(' ');
                            out.push_str(buffer.trim());
                        }
                        buffer.clear();
                    }
                } else {
                    out.push(ch);
                }
            }
            _ => {
                if depth > 0 {
                    buffer.push(ch);
                } else {
                    out.push(ch);
                }
            }
        }
    }

    if !buffer.trim().is_empty() {
        out.push(' ');
        out.push_str(buffer.trim());
    }
    out
}

/// Cuts everything from a `feat.` / `ft.` / `featuring` marker onward.
fn strip_featuring(input: &str) -> String {
    let lower = input.to_lowercase();
    for marker in [" feat. ", " feat ", " ft. ", " ft ", " featuring "] {
        if let Some(index) = lower.find(marker) {
            return input[..index].to_string();
        }
    }
    input.to_string()
}

/// Normalizes a title for matching: no feature credits, no version suffixes.
pub fn clean_title(raw: &str) -> String {
    let mut text = strip_bracketed(raw);

    let segments: Vec<&str> = text.split(" - ").collect();
    if segments.len() > 1 {
        let kept: Vec<&str> = segments
            .iter()
            .enumerate()
            .filter(|(index, segment)| *index == 0 || !contains_marker(segment))
            .map(|(_, segment)| *segment)
            .collect();
        text = kept.join(" - ");
    }

    text = strip_featuring(&text);
    normalize(&text)
}

/// The raw title first, then progressively cleaner forms, for a second lookup
/// when Spotify and Apple Music spell a track differently.
pub fn title_variants(raw: &str) -> Vec<String> {
    let mut variants = Vec::new();
    for candidate in [normalize(raw), clean_title(raw)] {
        if !candidate.is_empty() && !variants.contains(&candidate) {
            variants.push(candidate);
        }
    }
    variants
}

fn trigrams(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() < 3 {
        return vec![text.to_string()];
    }
    chars
        .windows(3)
        .map(|window| window.iter().collect())
        .collect()
}

/// Trigram Dice coefficient with a containment floor, on normalized text.
pub fn similarity(left: &str, right: &str) -> f32 {
    let left = normalize(left);
    let right = normalize(right);
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    if left == right {
        return 1.0;
    }

    let mut counts: HashMap<String, i32> = HashMap::new();
    for trigram in trigrams(&left) {
        *counts.entry(trigram).or_insert(0) += 1;
    }

    let right_trigrams = trigrams(&right);
    let mut shared = 0usize;
    for trigram in &right_trigrams {
        if let Some(remaining) = counts.get_mut(trigram) {
            if *remaining > 0 {
                *remaining -= 1;
                shared += 1;
            }
        }
    }

    let dice = (2.0 * shared as f32) / (left.len().max(1) as f32 + right_trigrams.len() as f32);
    let dice = if left.chars().count().max(right.chars().count()) < 3 {
        if left == right {
            1.0
        } else {
            0.0
        }
    } else {
        dice.min(1.0)
    };

    let containment = if left.contains(&right) || right.contains(&left) {
        0.82
    } else {
        0.0
    };

    dice.max(containment).clamp(0.0, 1.0)
}

/// Worst penalty implied by a candidate's title, artist, album or flags.
pub fn penalty(candidate: &Candidate) -> f32 {
    let mut haystack = format!(
        "{} {} {}",
        candidate.title,
        candidate.artist,
        candidate.album.clone().unwrap_or_default()
    )
    .to_lowercase();
    for flag in &candidate.flags {
        haystack.push(' ');
        haystack.push_str(&flag.to_lowercase());
    }

    PENALTIES
        .iter()
        .filter(|(marker, _)| haystack.contains(marker))
        .map(|(_, value)| *value)
        .fold(0.0, f32::max)
}

/// Blended confidence for a candidate against the track being played.
pub fn score(query: &TrackQuery, candidate: &Candidate) -> f32 {
    let title = title_variants(&query.title)
        .iter()
        .map(|variant| similarity(variant, &candidate.title))
        .fold(0.0, f32::max);
    let artist = similarity(&query.artist, &candidate.artist);

    let mut score = 0.62 * title + 0.28 * artist;

    if let Some(candidate_duration) = candidate.duration_ms {
        if query.duration_ms > 0 {
            let difference = (candidate_duration - query.duration_ms).abs();
            score += if difference <= 2_000 {
                0.10
            } else if difference <= 5_000 {
                0.02
            } else {
                -0.06
            };
        }
    }

    (score - penalty(candidate)).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(title: &str, artist: &str, duration_ms: i64) -> TrackQuery {
        TrackQuery {
            title: title.into(),
            artist: artist.into(),
            album: String::new(),
            duration_ms,
        }
    }

    #[test]
    fn strips_feature_credits() {
        assert_eq!(clean_title("Song Name (feat. Someone)"), "song name");
        assert_eq!(clean_title("Song Name feat. Someone"), "song name");
        assert_eq!(clean_title("Song Name (ft. A & B)"), "song name");
    }

    #[test]
    fn strips_version_suffixes() {
        assert_eq!(clean_title("Song Name - Remastered 2011"), "song name");
        assert_eq!(clean_title("Song Name - Single Version"), "song name");
        assert_eq!(clean_title("Song Name (Live at Wembley)"), "song name");
        assert_eq!(clean_title("Song Name [Radio Edit]"), "song name");
        assert_eq!(clean_title("Song Name - 2011 Remaster"), "song name");
    }

    #[test]
    fn keeps_title_words_that_look_like_markers() {
        assert_eq!(clean_title("Live Forever"), "live forever");
        assert_eq!(clean_title("Cover Me - Remastered"), "cover me");
    }

    #[test]
    fn keeps_meaningful_parentheses() {
        assert_eq!(clean_title("Song (Part 2)"), "song part 2");
    }

    #[test]
    fn variants_include_raw_and_cleaned() {
        let variants = title_variants("Song (feat. X)");
        assert_eq!(variants.len(), 2);
        assert!(variants.contains(&"song feat x".to_string()));
        assert!(variants.contains(&"song".to_string()));
    }

    #[test]
    fn similarity_is_bounded_and_ordered() {
        assert!((similarity("song name", "song name") - 1.0).abs() < 0.001);
        let close = similarity("song name", "song name part 2");
        let far = similarity("song name", "completely different");
        assert!(close > far, "{close} should beat {far}");
        assert!((0.0..=1.0).contains(&far));
    }

    #[test]
    fn similarity_handles_non_latin() {
        assert!((similarity("夜に駆ける", "夜に駆ける") - 1.0).abs() < 0.001);
        assert!(similarity("夜に駆ける", "群青") < 0.6);
        assert!((similarity("Кино", "кино") - 1.0).abs() < 0.001);
    }

    #[test]
    fn exact_match_scores_high() {
        let candidate = Candidate {
            title: "Tiny Dancer".into(),
            artist: "Elton John".into(),
            duration_ms: Some(317_000),
            ..Default::default()
        };
        let score = score(&query("Tiny Dancer", "Elton John", 316_000), &candidate);
        assert!(score > 0.9, "expected high confidence, got {score}");
    }

    #[test]
    fn karaoke_and_covers_are_penalized() {
        let base = Candidate {
            title: "Tiny Dancer".into(),
            artist: "Elton John".into(),
            duration_ms: Some(317_000),
            ..Default::default()
        };
        let karaoke = Candidate {
            title: "Tiny Dancer (Karaoke Version)".into(),
            artist: "The Karaoke Crew".into(),
            flags: vec!["karaoke".into()],
            ..base.clone()
        };
        assert!(score(&query("Tiny Dancer", "Elton John", 316_000), &karaoke) < 0.6);
    }

    #[test]
    fn artist_mismatch_lowers_confidence() {
        let right = Candidate {
            title: "Tiny Dancer".into(),
            artist: "Elton John".into(),
            ..Default::default()
        };
        let wrong = Candidate {
            title: "Tiny Dancer".into(),
            artist: "Some Other Band".into(),
            ..Default::default()
        };
        let q = query("Tiny Dancer", "Elton John", 316_000);
        assert!(score(&q, &right) > score(&q, &wrong));
    }

    #[test]
    fn duration_within_two_seconds_is_rewarded() {
        let close = Candidate {
            title: "Song".into(),
            artist: "Artist".into(),
            duration_ms: Some(201_000),
            ..Default::default()
        };
        let far = Candidate {
            duration_ms: Some(240_000),
            ..close.clone()
        };
        let q = query("Song", "Artist", 200_000);
        assert!(score(&q, &close) > score(&q, &far));
    }
}
