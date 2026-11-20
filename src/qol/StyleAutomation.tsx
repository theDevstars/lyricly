import { useEffect, useRef } from 'react';
import type { Snapshot } from '../types';
import { activeLineIndex, playbackPosition } from '../lib/timing';
import { detectSections, repeats, normalise } from '@lyrica/styles';
import { energyOf } from '@lyrica/styles';
import { moodOf, pick, poolFor } from './moods';
import { setStyle } from '../lib/api';

/** The pool: the pinned styles when the user has any, otherwise everything. */
function poolOf(snapshot: Snapshot, all: string[]): string[] {
  const pinned = snapshot.settings.randomizerPool ?? [];
  if (pinned.length > 0) return pinned;
  const saved = snapshot.settings.pinnedStyles ?? [];
  return saved.length > 0 ? saved : all;
}

/**
 * Style automation, driven from the overlay window: the randomizer switches on
 * every chorus or every N songs, and mood mode follows the song's energy.
 */
export function StyleAutomation({ snapshot, allIds }: { snapshot: Snapshot; allIds: string[] }) {
  const lastTrack = useRef(snapshot.trackKey);
  const songs = useRef(0);
  const lastChorus = useRef(-1);
  const lastMood = useRef('');
  const latest = useRef(snapshot);
  latest.current = snapshot;

  // Every N songs.
  useEffect(() => {
    if (snapshot.trackKey === lastTrack.current) return;
    lastTrack.current = snapshot.trackKey;
    songs.current += 1;

    const settings = snapshot.settings;
    if (settings.randomizerMode !== 'songs') return;
    const every = Math.max(1, settings.randomizerEverySongs || 1);
    if (songs.current % every !== 0) return;
    const next = pick(poolOf(snapshot, allIds), settings.style);
    if (next) void setStyle(next);
  }, [snapshot.trackKey, allIds]);

  // Every new chorus.
  useEffect(() => {
    const lines = snapshot.lyrics?.lines ?? [];
    if (lines.length === 0) return;
    const position = playbackPosition(snapshot);
    const index = activeLineIndex(lines, position);
    if (index < 0) return;

    const sections = detectSections(lines);
    const marks = repeats(lines);
    const line = lines[index];
    const chorus =
      Boolean(sections[index]?.chorus) || (marks[index].count > 1 && normalise(line.text).length > 2);

    if (!chorus) {
      lastChorus.current = -1;
      return;
    }
    if (lastChorus.current === index) return;
    lastChorus.current = index;

    const settings = latest.current.settings;
    if (settings.randomizerMode !== 'chorus') return;
    const next = pick(poolOf(latest.current, allIds), settings.style);
    if (next) void setStyle(next);
  }, [snapshot.playback.positionMs, snapshot.playback.sampledAtMs, snapshot.trackKey, allIds]);

  // Style by mood.
  useEffect(() => {
    const settings = latest.current.settings;
    if (!settings.moodMode || settings.randomizerMode !== 'off') return;
    const lines = snapshot.lyrics?.lines ?? [];
    if (lines.length === 0) return;

    const position = playbackPosition(snapshot);
    const index = activeLineIndex(lines, position);
    const energy = energyOf({ lines, activeIndex: index, positionMs: position });
    const mood = moodOf(energy.level);
    if (mood === lastMood.current) return;
    lastMood.current = mood;

    const next = pick(poolFor(mood), settings.style);
    if (next) void setStyle(next);
  }, [snapshot.playback.positionMs, snapshot.playback.sampledAtMs, snapshot.trackKey]);

  return null;
}
