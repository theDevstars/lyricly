//! Stage 1 timing for plain lyrics: distribute lines across the track by
//! syllable weight, after skipping a short intro. Instant, deterministic, and
//! always marked `Estimated` so the UI can say so.

use crate::lyrics::{LyricsResult, ProviderLine, Timing};

/// Share of the track treated as intro before the first line.
pub const DEFAULT_INTRO_RATIO: f32 = 0.08;
/// A line never gets less than this, so nothing collapses to zero length.
const MIN_LINE_MS: i64 = 700;

fn syllables(word: &str) -> usize {
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

fn line_weight(text: &str) -> f64 {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return 1.0;
    }
    // Syllables plus a small per-word cost, so short words are not free.
    words.iter().map(|word| syllables(word) as f64).sum::<f64>() + words.len() as f64 * 0.5
}

/// Start and end time for each line, monotonic and inside the track.
pub fn estimate(texts: &[String], duration_ms: i64, intro_ratio: f32) -> Vec<(i64, i64)> {
    if texts.is_empty() || duration_ms <= 0 {
        return Vec::new();
    }

    let intro = (duration_ms as f32 * intro_ratio.clamp(0.0, 0.4)) as i64;
    let start = intro.max(400).min(duration_ms / 2);
    let span = (duration_ms - start).max(texts.len() as i64 * MIN_LINE_MS);

    let weights: Vec<f64> = texts.iter().map(|text| line_weight(text)).collect();
    let total: f64 = weights.iter().sum::<f64>().max(1.0);

    let mut timed = Vec::with_capacity(texts.len());
    let mut cursor = start as f64;
    for (index, weight) in weights.iter().enumerate() {
        let share = weight / total * span as f64;
        let line_start = cursor.round() as i64;
        let line_end = if index == texts.len() - 1 {
            start + span
        } else {
            (cursor + share).round() as i64
        };
        timed.push((line_start, line_end.max(line_start + 60)));
        cursor += share;
    }

    timed
}

/// Gives a plain result estimated timing. Returns `false` when it cannot.
pub fn apply(result: &mut LyricsResult, duration_ms: i64) -> bool {
    if !matches!(result.timing, Timing::Unsynced) || duration_ms <= 0 {
        return false;
    }

    let texts: Vec<String> = result
        .lines
        .iter()
        .map(|line| line.text.clone())
        .collect();
    let timed = estimate(&texts, duration_ms, DEFAULT_INTRO_RATIO);
    if timed.len() != result.lines.len() {
        return false;
    }

    result.lines = result
        .lines
        .iter()
        .zip(timed)
        .map(|(line, (start, end))| ProviderLine {
            start_ms: Some(start.clamp(0, u32::MAX as i64) as u32),
            end_ms: Some(end.clamp(0, u32::MAX as i64) as u32),
            text: line.text.clone(),
            words: None,
        })
        .collect();
    result.timing = Timing::Estimated;
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(texts: &[&str]) -> Vec<String> {
        texts.iter().map(|text| text.to_string()).collect()
    }

    #[test]
    fn output_is_monotonic_and_bounded() {
        let texts = lines(&["first line here", "second line is longer than the first", "third"]);
        let timed = estimate(&texts, 200_000, DEFAULT_INTRO_RATIO);

        assert_eq!(timed.len(), 3);
        assert!(timed[0].0 >= 0, "cannot start before the track");
        for pair in timed.windows(2) {
            assert!(pair[0].1 <= pair[1].0, "lines must not overlap");
            assert!(pair[1].0 > pair[0].0, "starts must advance");
        }
        let last = timed.last().expect("last");
        assert!(last.1 <= 200_000, "must end inside the track, got {}", last.1);
    }

    #[test]
    fn skips_an_intro() {
        let texts = lines(&["one", "two"]);
        let timed = estimate(&texts, 100_000, 0.10);
        assert!(
            timed[0].0 >= 9_000,
            "first line should wait for the intro, got {}",
            timed[0].0
        );
    }

    #[test]
    fn longer_lines_get_more_time() {
        let texts = lines(&["short", "this line has considerably more syllables in it"]);
        let timed = estimate(&texts, 60_000, 0.0);
        let first = timed[0].1 - timed[0].0;
        let second = timed[1].1 - timed[1].0;
        assert!(second > first, "second={second} should exceed first={first}");
    }

    #[test]
    fn empty_input_is_a_no_op() {
        assert!(estimate(&[], 100_000, 0.08).is_empty());
        assert!(estimate(&lines(&["one"]), 0, 0.08).is_empty());
    }

    #[test]
    fn apply_marks_the_result_estimated() {
        let mut result = LyricsResult {
            lines: lines(&["first", "second"])
                .into_iter()
                .map(|text| ProviderLine {
                    start_ms: None,
                    end_ms: None,
                    text,
                    words: None,
                })
                .collect(),
            timing: Timing::Unsynced,
            source: "Genius".into(),
            source_url: None,
            confidence: 0.8,
            attribution: None,
            instrumental: false,
        };

        assert!(apply(&mut result, 180_000));
        assert_eq!(result.timing, Timing::Estimated);
        assert!(result.lines.iter().all(|line| line.start_ms.is_some()));
        assert!(result.lines[1].start_ms > result.lines[0].start_ms);
    }

    #[test]
    fn apply_leaves_synced_results_alone() {
        let mut result = LyricsResult {
            lines: Vec::new(),
            timing: Timing::LineSynced,
            source: "LRCLIB".into(),
            source_url: None,
            confidence: 0.9,
            attribution: None,
            instrumental: false,
        };
        assert!(!apply(&mut result, 180_000));
        assert_eq!(result.timing, Timing::LineSynced);
    }
}
