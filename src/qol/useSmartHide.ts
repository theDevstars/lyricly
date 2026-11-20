import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../types';
import { activeLineIndex, playbackPosition } from '../lib/timing';

/** A gap this long between lines reads as an instrumental break. */
const INSTRUMENTAL_GAP_MS = 4500;

export interface SmartHide {
  /** Paused for longer than the user's threshold, so the lyrics step aside. */
  paused: boolean;
  /** Something is playing but no lyrics came back. */
  noLyrics: boolean;
  /** The song is between lines for a while: an instrumental, most likely. */
  instrumental: boolean;
  /** The same track has restarted on loop. */
  repeated: boolean;
  /** A rule asked for the overlays to go away. */
  hidden: boolean;
}

/**
 * Derives everything the lyrics window needs to be quiet. It has no timer of
 * its own beyond the pause threshold, so idle cost is unchanged.
 */
export function useSmartHide(snapshot: Snapshot): SmartHide {
  const { settings, qol } = snapshot;
  const playing = snapshot.playback.status === 'playing';
  const [paused, setPaused] = useState(false);
  const pauseStart = useRef<number | null>(null);

  useEffect(() => {
    if (!settings.qolSmartHide || settings.qolHidePausedSeconds <= 0 || playing) {
      setPaused(false);
      pauseStart.current = null;
      return;
    }

    pauseStart.current = Date.now();
    const delay = settings.qolHidePausedSeconds * 1000;
    const timer = window.setTimeout(() => setPaused(true), delay);
    return () => window.clearTimeout(timer);
  }, [playing, settings.qolSmartHide, settings.qolHidePausedSeconds]);

  const lines = snapshot.lyrics?.lines ?? [];
  const position = playbackPosition(snapshot);
  const index = activeLineIndex(lines, position);
  const next = index >= 0 ? lines[index + 1] : undefined;
  const instrumental =
    playing &&
    lines.length > 0 &&
    index >= 0 &&
    next !== undefined &&
    next.startMs - position > INSTRUMENTAL_GAP_MS;

  // A missing lyric is reported as an error by the pipeline; that is the same
  // situation as "no lyrics", not a failure worth a red hint.
  const noLyricsError = Boolean(snapshot.error && /no lyrics/i.test(snapshot.error));
  const noLyrics =
    playing &&
    Boolean(snapshot.playback.title) &&
    !snapshot.loading &&
    (!snapshot.lyrics || noLyricsError);

  const repeated =
    settings.qolEnabled && settings.qolHideOnRepeat && qol.repeated >= 1;

  return {
    paused,
    noLyrics,
    instrumental,
    repeated,
    hidden: qol.hideOverlays || repeated,
  };
}
