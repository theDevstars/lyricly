/**
 * One requestAnimationFrame loop for the whole page.
 * Subscribers receive elapsed seconds and paint in the same frame.
 */
type Subscriber = (elapsed: number, delta: number) => void;

const subscribers = new Set<Subscriber>();
let rafId = 0;
let last = 0;
let startedAt = 0;
let paused = false;
let pauseStartedAt = 0;
let pausedFor = 0;

function frame(now: number) {
  rafId = requestAnimationFrame(frame);
  const delta = Math.min((now - last) / 1000, 0.1);
  last = now;
  const elapsed = (now - startedAt - pausedFor) / 1000;
  if (paused || delta <= 0) return;
  subscribers.forEach((fn) => fn(elapsed, delta));
}

function start() {
  if (rafId || typeof window === "undefined") return;
  if (document.hidden) return;
  last = performance.now();
  if (!startedAt) startedAt = last;
  rafId = requestAnimationFrame(frame);
}

function stop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

export function subscribe(fn: Subscriber) {
  subscribers.add(fn);
  start();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) stop();
  };
}

export function setTickerPaused(value: boolean) {
  if (value === paused) return;
  const now = performance.now();
  if (value) {
    pauseStartedAt = now;
  } else {
    pausedFor += now - pauseStartedAt;
  }
  paused = value;
}

export function resetTicker() {
  startedAt = 0;
  pausedFor = 0;
  paused = false;
  last = 0;
}

export function isTickerPaused() {
  return paused;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (subscribers.size) {
      pausedFor += 0;
      start();
    }
  });
}
