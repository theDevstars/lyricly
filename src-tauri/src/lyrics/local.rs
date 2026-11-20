//! Provider 1: the local SQLite cache plus `.lrc` / `.txt` files the user
//! dropped in or edited by hand for a track.

use crate::lyrics::cache::{Cache, DEFAULT_TTL_MS};
use crate::lyrics::lrclib::result_from_engine;
use crate::lyrics::{
    cache_key, plain_result, LyricsProvider, LyricsResult, ProviderError, TrackQuery,
};
use async_trait::async_trait;
use std::sync::Arc;

pub struct LocalProvider {
    cache: Arc<Cache>,
}

impl LocalProvider {
    pub fn new(cache: Arc<Cache>) -> Self {
        Self { cache }
    }
}

#[async_trait]
impl LyricsProvider for LocalProvider {
    fn id(&self) -> &'static str {
        "local"
    }

    fn name(&self) -> &'static str {
        "Local cache & files"
    }

    async fn fetch(&self, query: TrackQuery) -> Result<LyricsResult, ProviderError> {
        let key = cache_key(&query);

        if let Some(cached) = self.cache.positive(&key, DEFAULT_TTL_MS) {
            return Ok(cached);
        }

        let Some(path) = self.cache.override_path(&key) else {
            return Err(ProviderError::NotFound);
        };

        let raw = std::fs::read_to_string(&path).map_err(|error| {
            ProviderError::Upstream(format!("could not read {path}: {error}"))
        })?;

        if let Some(lyrics) = crate::lyrics::parse_lrc(&raw, "Local file") {
            let mut result = result_from_engine(lyrics, 1.0);
            result.source_url = Some(path.clone());
            result.attribution = Some("Lyrics from your local file".into());
            return Ok(result);
        }

        let mut result = plain_result(&raw, "Local file", 1.0);
        if result.lines.is_empty() {
            return Err(ProviderError::NotFound);
        }
        result.source_url = Some(path);
        result.attribution = Some("Lyrics from your local file".into());
        Ok(result)
    }
}
