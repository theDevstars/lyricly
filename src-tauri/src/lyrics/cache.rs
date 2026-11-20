//! SQLite-backed lyrics cache: resolved results, negative entries, user
//! overrides and per-track source choices.

#![allow(dead_code)] // wired into the pipeline in the next step

use crate::lyrics::LyricsResult;
use crate::media::now_ms;
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;

pub const DEFAULT_TTL_MS: i64 = 30 * 24 * 60 * 60 * 1000;
pub const NEGATIVE_TTL_MS: i64 = 24 * 60 * 60 * 1000;

pub struct Cache {
    connection: Mutex<Connection>,
}

impl Cache {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let connection = Connection::open(path)?;
        Self::prepare(connection)
    }

    #[cfg(test)]
    pub fn in_memory() -> Self {
        Self::prepare(Connection::open_in_memory().expect("in-memory database"))
            .expect("cache schema")
    }

    fn prepare(connection: Connection) -> Result<Self> {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS lyrics_cache (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                source TEXT NOT NULL,
                fetched_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lyrics_negative (
                key TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                fetched_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lyrics_overrides (
                key TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lyrics_choices (
                key TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn positive(&self, key: &str, max_age_ms: i64) -> Option<LyricsResult> {
        let connection = self.connection.lock().ok()?;
        let row: Option<(String, i64)> = connection
            .query_row(
                "SELECT payload, fetched_at FROM lyrics_cache WHERE key = ?1",
                params![key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .ok()?;

        let (payload, fetched_at) = row?;
        if now_ms() - fetched_at > max_age_ms {
            return None;
        }
        serde_json::from_str(&payload).ok()
    }

    pub fn put_positive(&self, key: &str, result: &LyricsResult) {
        let Ok(payload) = serde_json::to_string(result) else {
            return;
        };
        let Ok(connection) = self.connection.lock() else {
            return;
        };
        let _ = connection.execute(
            "INSERT INTO lyrics_cache (key, payload, source, fetched_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, source = excluded.source, fetched_at = excluded.fetched_at",
            params![key, payload, result.source, now_ms()],
        );
        let _ = connection.execute("DELETE FROM lyrics_negative WHERE key = ?1", params![key]);
    }

    /// A fresh negative entry is returned as the reason it failed.
    pub fn negative(&self, key: &str) -> Option<String> {
        self.negative_at(key, now_ms())
    }

    fn negative_at(&self, key: &str, at: i64) -> Option<String> {
        let connection = self.connection.lock().ok()?;
        let row: Option<(String, i64)> = connection
            .query_row(
                "SELECT reason, fetched_at FROM lyrics_negative WHERE key = ?1",
                params![key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .ok()?;

        let (reason, fetched_at) = row?;
        if at - fetched_at > NEGATIVE_TTL_MS {
            return None;
        }
        Some(reason)
    }

    pub fn put_negative(&self, key: &str, reason: &str) {
        let Ok(connection) = self.connection.lock() else {
            return;
        };
        let _ = connection.execute(
            "INSERT INTO lyrics_negative (key, reason, fetched_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET reason = excluded.reason, fetched_at = excluded.fetched_at",
            params![key, reason, now_ms()],
        );
    }

    /// Drops a cached result so the next lookup reads fresh (or an override).
    pub fn forget(&self, key: &str) {
        if let Ok(connection) = self.connection.lock() {
            let _ = connection.execute("DELETE FROM lyrics_cache WHERE key = ?1", params![key]);
        }
    }

    pub fn clear_negative(&self, key: &str) {
        if let Ok(connection) = self.connection.lock() {
            let _ = connection.execute("DELETE FROM lyrics_negative WHERE key = ?1", params![key]);
        }
    }

    /// Remembers a `.lrc` / `.txt` file the user dropped in for a track.
    pub fn set_override(&self, key: &str, path: &str) {
        if let Ok(connection) = self.connection.lock() {
            let _ = connection.execute(
                "INSERT INTO lyrics_overrides (key, path, updated_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET path = excluded.path, updated_at = excluded.updated_at",
                params![key, path, now_ms()],
            );
        }
    }

    pub fn override_path(&self, key: &str) -> Option<String> {
        let connection = self.connection.lock().ok()?;
        connection
            .query_row(
                "SELECT path FROM lyrics_overrides WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .ok()?
    }

    /// The source the user picked for a track in the "Wrong lyrics?" picker.
    pub fn set_choice(&self, key: &str, provider: &str) {
        if let Ok(connection) = self.connection.lock() {
            let _ = connection.execute(
                "INSERT INTO lyrics_choices (key, provider, updated_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET provider = excluded.provider, updated_at = excluded.updated_at",
                params![key, provider, now_ms()],
            );
        }
    }

    pub fn choice(&self, key: &str) -> Option<String> {
        let connection = self.connection.lock().ok()?;
        connection
            .query_row(
                "SELECT provider FROM lyrics_choices WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .ok()?
    }

    pub fn clear(&self) {
        if let Ok(connection) = self.connection.lock() {
            let _ = connection.execute("DELETE FROM lyrics_cache", []);
            let _ = connection.execute("DELETE FROM lyrics_negative", []);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lyrics::{ProviderLine, Timing};

    fn sample() -> LyricsResult {
        LyricsResult {
            lines: vec![ProviderLine {
                start_ms: Some(1_000),
                end_ms: Some(2_000),
                text: "invented line".into(),
                words: None,
            }],
            timing: Timing::LineSynced,
            source: "LRCLIB".into(),
            source_url: None,
            confidence: 0.91,
            attribution: None,
            instrumental: false,
        }
    }

    #[test]
    fn positive_roundtrip() {
        let cache = Cache::in_memory();
        cache.put_positive("k", &sample());
        let found = cache.positive("k", DEFAULT_TTL_MS).expect("cached");
        assert_eq!(found.source, "LRCLIB");
        assert_eq!(found.lines.len(), 1);
        assert!((found.confidence - 0.91).abs() < 0.001);
    }

    #[test]
    fn expired_positive_is_a_miss() {
        let cache = Cache::in_memory();
        cache.put_positive("k", &sample());
        assert!(cache.positive("k", -1).is_none());
    }

    #[test]
    fn negative_is_cached_then_cleared_by_a_hit() {
        let cache = Cache::in_memory();
        cache.put_negative("k", "Not on LRCLIB");
        assert_eq!(cache.negative("k").as_deref(), Some("Not on LRCLIB"));

        cache.put_positive("k", &sample());
        assert!(cache.negative("k").is_none());
    }

    #[test]
    fn negative_expires_after_a_day() {
        let cache = Cache::in_memory();
        cache.put_negative("k", "nope");
        let stale = now_ms() + NEGATIVE_TTL_MS + 1_000;
        assert!(cache.negative_at("k", stale).is_none());
    }

    #[test]
    fn overrides_and_choices_persist() {
        let cache = Cache::in_memory();
        cache.set_override("k", r"C:\lyrics\song.lrc");
        assert_eq!(cache.override_path("k").as_deref(), Some(r"C:\lyrics\song.lrc"));

        cache.set_choice("k", "genius");
        assert_eq!(cache.choice("k").as_deref(), Some("genius"));
    }

    #[test]
    fn clear_drops_results_and_negatives() {
        let cache = Cache::in_memory();
        cache.put_positive("a", &sample());
        cache.put_negative("b", "none");
        cache.clear();
        assert!(cache.positive("a", DEFAULT_TTL_MS).is_none());
        assert!(cache.negative("b").is_none());
    }
}
