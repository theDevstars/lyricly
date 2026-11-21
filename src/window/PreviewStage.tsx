import { useMemo } from 'react';
import { StyleCanvas } from '../components/StyleCanvas';
import {
  DEMO_ALBUM,
  DEMO_ART_PALETTE,
  DEMO_ARTIST,
  DEMO_DURATION_MS,
  DEMO_LINES,
  DEMO_TITLE,
} from '../demo/demoTrack';
import type { DemoPlayer } from '../demo/useDemoPlayer';
import type { LyricStyle } from '@lyrica/styles';
import type { Snapshot } from '../types';

interface PreviewStageProps {
  snapshot: Snapshot;
  style: LyricStyle;
  demo: DemoPlayer;
  source: 'demo' | 'now';
}

/**
 * Renders a style through the same StyleCanvas the real displays use, so the
 * preview cannot drift from what the screen shows.
 */
export function PreviewStage({ snapshot, style, demo, source }: PreviewStageProps) {
  const preview = useMemo<Snapshot>(() => {
    if (source === 'now') return snapshot;

    return {
      ...snapshot,
      playback: {
        app: 'Demo',
        title: DEMO_TITLE,
        artist: DEMO_ARTIST,
        album: DEMO_ALBUM,
        status: demo.playing ? 'playing' : 'paused',
        positionMs: demo.positionMs,
        durationMs: DEMO_DURATION_MS,
        sampledAtMs: Date.now(),
      },
      artPalette: DEMO_ART_PALETTE,
      lyrics: {
        source: 'Demo',
        lines: DEMO_LINES,
        timing: 'wordSynced',
        attribution: 'Invented sample lyric',
      },
      trackKey: 'demo',
      loading: false,
      error: null,
    };
  }, [snapshot, source, demo.positionMs, demo.playing]);

  return (
    <div className="preview-stage">
      <StyleCanvas snapshot={preview} style={style} className="stage-canvas" />
      <div className="preview-meta">
        <strong>{preview.playback.title || 'Nothing playing'}</strong>
        <span>{preview.playback.artist}</span>
        <em>{style.name}</em>
      </div>
    </div>
  );
}
