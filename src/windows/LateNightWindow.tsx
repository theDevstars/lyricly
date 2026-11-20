import { useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '../types';
import { setLateNight } from '../lib/api';

/** Ignore input for a moment after opening, so the click that started it does
 *  not immediately close it. */
const GRACE_MS = 450;
/** Mouse movement under this many pixels does not count as "moved". */
const DEAD_ZONE_PX = 2;
const FADE_MS = 300;

interface LateNightWindowProps {
  snapshot: Snapshot;
}

/**
 * Full-screen lock-screen-styled screen. Windows does not allow apps to draw on
 * the real lock screen, so this is a dim takeover of the desktop instead.
 */
export function LateNightWindow({ snapshot }: LateNightWindowProps) {
  const [now, setNow] = useState(() => new Date());
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const armedAt = useRef(performance.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const exit = useMemo(
    () => () => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      setLeaving(true);
      window.setTimeout(() => {
        void setLateNight(false);
      }, FADE_MS + 20);
    },
    [],
  );

  useEffect(() => {
    armedAt.current = performance.now();
    origin.current = null;
    const armed = () => performance.now() - armedAt.current >= GRACE_MS;

    const move = (event: MouseEvent) => {
      if (!armed()) return;
      const start = origin.current;
      if (!start) {
        origin.current = { x: event.clientX, y: event.clientY };
        return;
      }
      if (
        Math.abs(event.clientX - start.x) > DEAD_ZONE_PX ||
        Math.abs(event.clientY - start.y) > DEAD_ZONE_PX
      ) {
        exit();
      }
    };
    const key = () => {
      if (armed()) exit();
    };
    const click = () => {
      if (armed()) exit();
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', click);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', click);
    };
  }, [exit]);

  const settings = snapshot.settings;
  const background = settings.lateNightBackground === 'dim' ? 'dim' : 'black';

  return (
    <div className={`late-night ${background} ${leaving ? 'leaving' : ''}`}>
      {settings.lateNightClock && (
        <header className="late-night-head">
          <p className="late-night-date">{formatDate(now)}</p>
          <p className="late-night-clock">{formatTime(now, settings.lateNight24h)}</p>
        </header>
      )}

      <footer className="late-night-foot">
        <span>
          {snapshot.playback.title
            ? `${snapshot.playback.title} — ${snapshot.playback.artist}`
            : 'Nothing playing'}
        </span>
        <em>Move the mouse or press any key to exit</em>
      </footer>
    </div>
  );
}

function formatTime(date: Date, use24h: boolean): string {
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const hours = date.getHours();
  if (use24h) return `${hours.toString().padStart(2, '0')}:${minutes}`;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
