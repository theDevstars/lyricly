//! SQLite cache for resolved lyrics, keyed by track identity.

use crate::lyrics::Lyrics;
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;

pub struct Db {
    connection: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let connection = Connection::open(path)?;
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS lyrics (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                fetched_at INTEGER NOT NULL
            );",
        )?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn get(&self, key: &str, max_age_ms: i64) -> Option<Lyrics> {
        let connection = self.connection.lock().ok()?;
        let row: Option<(String, i64)> = connection
            .query_row(
                "SELECT payload, fetched_at FROM lyrics WHERE key = ?1",
                params![key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .ok()?;

        let (payload, fetched_at) = row?;
        let age = crate::media::now_ms() - fetched_at;
        if age > max_age_ms {
            return None;
        }
        serde_json::from_str(&payload).ok()
    }

    pub fn put(&self, key: &str, lyrics: &Lyrics) {
        let Ok(payload) = serde_json::to_string(lyrics) else {
            return;
        };
        let Ok(connection) = self.connection.lock() else {
            return;
        };
        let _ = connection.execute(
            "INSERT INTO lyrics (key, payload, fetched_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at",
            params![key, payload, crate::media::now_ms()],
        );
    }

    pub fn clear(&self) {
        if let Ok(connection) = self.connection.lock() {
            let _ = connection.execute("DELETE FROM lyrics", []);
        }
    }
}
