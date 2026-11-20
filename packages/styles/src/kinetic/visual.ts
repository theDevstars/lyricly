import { iconFor } from '../icons';
import { clamp01, wordGap, type LyricStyle } from '../types';

/**
 * Visual — a centered stack: the previous line above, the live line in the
 * middle and the next line below, with an icon for every word that has one.
 */
export const visual: LyricStyle = {
  id: 'visual',
  name: 'Visual',
  description: 'A centered stack, with an icon for every word that has one.',
  group: 'kinetic',
  usesIcons: true,
  gradient: ['#10231f', '#2f7d69'],
  palette: {
    accent: '#8ef0c9',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.34)',
    background: '#050807',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#050807');
    backdrop.addColorStop(0.6, '#0a1614');
    backdrop.addColorStop(1, '#040606');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const index = state.activeIndex;
    const current = index >= 0 ? state.lines[index] : null;
    const previous = index > 0 ? state.lines[index - 1] : null;
    const next = index >= 0 ? state.lines[index + 1] : null;

    const baseSize = Math.min(58, Math.max(26, width / 13));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!current) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `500 ${baseSize * 0.42}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(state.track.title ? 'Waiting for the next line…' : 'Play something on Spotify or Apple Music', cx, cy);
      return;
    }

    // Previous line, receding up.
    if (previous) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ffffff';
      ctx.font = `500 ${baseSize * 0.5}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(previous.text, cx, cy - baseSize * 1.5);
      ctx.globalAlpha = 1;
    }

    // Next line, waiting below.
    if (next) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.font = `500 ${baseSize * 0.56}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(next.text, cx, cy + baseSize * 1.5);
      ctx.globalAlpha = 1;
    }

    drawWords(ctx, current.words, state, cx, cy, baseSize, palette.accent);
  },
};

/** Lays out words plus icons on one centered line. */
export function drawWords(
  ctx: CanvasRenderingContext2D,
  words: { text: string; startMs: number; endMs: number }[],
  state: { positionMs: number; wordIndex: number; wordProgress: number },
  cx: number,
  cy: number,
  fontSize: number,
  accent: string,
): void {
  const items = words.map((word) => ({
    text: word.text,
    icon: iconFor(word.text),
    startMs: word.startMs,
    endMs: word.endMs,
  }));

  const gap = fontSize * 0.32;
  const iconSize = fontSize * 0.72;

  ctx.font = `600 ${fontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
  const widths = items.map((item) => {
    const textWidth = ctx.measureText(item.text).width;
    return textWidth + (item.icon ? iconSize + gap * 0.55 : 0);
  });

  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, items.length - 1);
  let x = cx - total / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  items.forEach((item, index) => {
    const width = widths[index];
    const active = index === state.wordIndex;
    const sung = item.endMs <= state.positionMs;

    if (item.icon) {
      ctx.font = `${iconSize}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
      ctx.globalAlpha = active ? 1 : sung ? 0.85 : 0.45;
      ctx.fillText(item.icon, x, cy);
      x += iconSize + gap * 0.55;
    }

    ctx.font = `${active ? 700 : 600} ${fontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
    ctx.globalAlpha = active ? 1 : sung ? 0.9 : 0.42;
    if (active) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 24;
      ctx.fillStyle = accent;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillText(item.text, x, cy);
    ctx.shadowBlur = 0;

    x += item.text ? ctx.measureText(item.text).width : width;
    if (index < items.length - 1) {
      x += wordGap(item.text, items[index + 1].text, gap);
    }
  });

  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';

  // Progress ticks under the active word.
  const progress = clamp01(state.wordProgress);
  if (progress > 0) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(cx - fontSize * 0.9, cy + fontSize * 0.86, fontSize * 1.8 * progress, 2);
    ctx.globalAlpha = 1;
  }
}
