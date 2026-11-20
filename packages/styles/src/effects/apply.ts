import type { StyleState } from '../types';
import { energyOf } from '../lib/energy';
import type { Effect } from './registry';

/**
 * The shared effects layer. `pre` paints behind a style (reactive light), `post`
 * paints over it (particles, beat light, emphasis glow). Every effect is
 * independent, and flashing ones are filtered out before they get here.
 */

const has = (effects: Effect[], id: string): boolean => effects.some((effect) => effect.id === id);

export function preEffects(
  ctx: CanvasRenderingContext2D,
  state: StyleState,
  effects: Effect[],
): void {
  if (!has(effects, 'reactive')) return;
  const energy = energyOf(state);
  const paint = ctx.createRadialGradient(
    state.width * 0.5,
    state.height * 0.55,
    state.height * 0.05,
    state.width * 0.5,
    state.height * 0.55,
    state.height * (0.55 + energy.level * 0.35),
  );
  paint.addColorStop(0, hexAlpha(state.palette.accent, 0.16 + energy.level * 0.18));
  paint.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, state.width, state.height);
}

export function postEffects(
  ctx: CanvasRenderingContext2D,
  state: StyleState,
  effects: Effect[],
): void {
  const energy = energyOf(state);

  if (has(effects, 'particles')) drawParticles(ctx, state, energy.level);
  // A real beat from the audio device is sharper than the lyric estimate.
  const beat = Boolean(state.audio?.active && state.audio.beat);
  if (has(effects, 'emphasis')) drawEmphasis(ctx, state);
  if (has(effects, 'chorus') && state.lineProgress > 0.05) drawChorusLift(ctx, state);
  if (has(effects, 'beat')) drawBeatLight(ctx, state, energy.pulse, beat);
  if (has(effects, 'parallax')) drawParallax(ctx, state);
  if (has(effects, 'rhyme')) drawRhymeTicks(ctx, state);
}

function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(255,255,255,${alpha})`;
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Sparks lift off the word being sung. Deterministic per word. */
function drawParticles(ctx: CanvasRenderingContext2D, state: StyleState, level: number): void {
  if (state.wordIndex < 0) return;
  const count = 8 + Math.round(level * 10) + Math.round((state.audio?.active ? state.audio.level : 0) * 8);
  const progress = state.wordProgress;
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    const seed = Math.sin(index * 12.9898 + state.wordIndex * 78.233) * 43758.5453;
    const unit = seed - Math.floor(seed);
    const x = state.width * (0.2 + unit * 0.6);
    const rise = progress * state.height * (0.18 + unit * 0.22);
    const y = state.height / 2 - rise;
    ctx.globalAlpha = Math.max(0, 1 - progress) * (0.2 + unit * 0.5);
    ctx.fillStyle = state.palette.accent;
    ctx.beginPath();
    ctx.arc(x, y, 1 + unit * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A soft underline glow under the active line. */
function drawEmphasis(ctx: CanvasRenderingContext2D, state: StyleState): void {
  if (state.wordIndex < 0) return;
  const paint = ctx.createLinearGradient(0, 0, state.width, 0);
  paint.addColorStop(0, 'rgba(255,255,255,0)');
  paint.addColorStop(0.5, hexAlpha(state.palette.accent, 0.18));
  paint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = paint;
  ctx.fillRect(0, state.height * 0.66, state.width, Math.max(1, state.height * 0.002));
}

/** Repeated lines get a brighter frame. */
function drawChorusLift(ctx: CanvasRenderingContext2D, state: StyleState): void {
  const line = state.lines[state.activeIndex];
  if (!line) return;
  const key = line.text.trim().toLowerCase();
  const again = state.lines.some((other) => other !== line && other.text.trim().toLowerCase() === key);
  if (!again) return;
  ctx.fillStyle = hexAlpha(state.palette.accent, 0.05);
  ctx.fillRect(0, 0, state.width, state.height);
}

/** A single soft pulse per beat, never faster than 3 Hz. */
function drawBeatLight(
  ctx: CanvasRenderingContext2D,
  state: StyleState,
  pulse: number,
  beat: boolean,
): void {
  // On a detected beat the frame lifts once; otherwise the bpm grid keeps time.
  const strength = Math.max(0, 1 - pulse) ** 2 * 0.08 + (beat ? 0.06 : 0);
  ctx.fillStyle = hexAlpha(state.palette.accent, strength);
  ctx.fillRect(0, 0, state.width, state.height);
}

/** The frame drifts a few pixels, as if the camera moved. */
function drawParallax(ctx: CanvasRenderingContext2D, state: StyleState): void {
  const drift = Math.sin(state.time / 5200) * 0.5 + 0.5;
  const paint = ctx.createLinearGradient(0, 0, state.width, state.height);
  paint.addColorStop(0, hexAlpha(state.palette.accent, 0.04 * (1 - drift)));
  paint.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, state.width, state.height);
}

/** Small colour ticks marking the active word, the rhyme-colour hint. */
function drawRhymeTicks(ctx: CanvasRenderingContext2D, state: StyleState): void {
  const line = state.lines[state.activeIndex];
  if (!line || line.words.length < 2) return;
  const y = state.height * 0.7;
  line.words.forEach((_, index) => {
    const x = state.width * (0.12 + (index / Math.max(1, line.words.length)) * 0.76);
    ctx.fillStyle = hexAlpha(
      index === state.wordIndex ? state.palette.accent : state.palette.text,
      index === state.wordIndex ? 0.6 : 0.12,
    );
    ctx.fillRect(x, y, Math.max(2, state.width * 0.004), Math.max(2, state.height * 0.006));
  });
}
