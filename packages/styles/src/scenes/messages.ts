import { clamp01, wordGap, type LyricStyle } from '../types';
import { threadAt, type Side, type ThreadItem } from './messagesModel';

const BLACK = '#000000';
const IN_BG = '#262629';
const OUT_BG = '#0a84ff';
const RADIUS = 20;
const PAD_X = 16;
const PAD_Y = 10;
const GAP_SAME = 2;
const GAP_SIDE = 10;
const TYPE_MIN = 17;
const TYPE_MAX = 20;
const SPRING_MS = 140;
const RING_FADE_MS = 400;
const MAX_ITEMS = 12;

const fontOf = (size: number, weight = 500): string =>
  `${weight} ${size}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;

const easeOut = (value: number): number => 1 - (1 - value) ** 3;

/** "Today 3:47 PM", captured once per track so it never ticks. */
const stamps = new Map<string, string>();
function stampFor(key: string): string {
  const existing = stamps.get(key);
  if (existing) return existing;
  const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const stamp = `Today ${time}`;
  if (stamps.size > 16) stamps.clear();
  stamps.set(key, stamp);
  return stamp;
}

interface LaidWord {
  text: string;
  x: number;
  width: number;
  emphasis: boolean;
}

interface BubbleLayout {
  rows: LaidWord[][];
  width: number;
  height: number;
}

interface Fonts {
  baseSize: number;
  emphasisSize: number;
  base: string;
  emphasis: string;
  lineHeight: number;
}

function layoutBubble(
  ctx: CanvasRenderingContext2D,
  item: ThreadItem,
  fonts: Fonts,
  maxWidth: number,
  revealed: number,
): BubbleLayout {
  const words = item.phrase.words.slice(0, Math.max(1, revealed));
  const space = ctx.measureText(' ').width;
  const rows: LaidWord[][] = [];
  let row: LaidWord[] = [];
  let cursor = 0;

  words.forEach((word, index) => {
    const emphasis = index === item.emphasis;
    ctx.font = emphasis ? fonts.emphasis : fonts.base;
    const width = ctx.measureText(word.text).width;
    let x = 0;
    if (row.length > 0) {
      const previous = row[row.length - 1].text;
      x = cursor + wordGap(previous, word.text, space);
    }
    if (row.length > 0 && x + width > maxWidth) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push({ text: word.text, x, width, emphasis });
    cursor = x + width;
  });
  if (row.length > 0) rows.push(row);

  const widest = rows.reduce((best, entry) => {
    const last = entry[entry.length - 1];
    return Math.max(best, last ? last.x + last.width : 0);
  }, 0);

  return {
    rows,
    width: widest + PAD_X * 2,
    height: rows.length * fonts.lineHeight + PAD_Y * 2,
  };
}

function bubblePath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, RADIUS);
}

/** The little tail that marks the end of a group, mirrored for the side. */
function drawTail(
  ctx: CanvasRenderingContext2D,
  side: Side,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const bottom = top + height;
  ctx.beginPath();
  if (side === 'out') {
    const right = left + width;
    ctx.moveTo(right - 14, bottom - 6);
    ctx.quadraticCurveTo(right + 2, bottom - 4, right + 1, bottom + 5);
    ctx.quadraticCurveTo(right - 6, bottom + 1, right - 12, bottom + 1);
  } else {
    ctx.moveTo(left + 14, bottom - 6);
    ctx.quadraticCurveTo(left - 2, bottom - 4, left - 1, bottom + 5);
    ctx.quadraticCurveTo(left + 6, bottom + 1, left + 12, bottom + 1);
  }
  ctx.closePath();
  ctx.fill();
}

function drawTyping(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  fontSize: number,
  time: number,
  pulsing: boolean,
): { width: number; height: number } {
  const width = fontSize * 2.4;
  const height = fontSize * 1.5;
  ctx.fillStyle = IN_BG;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, height / 2);
  ctx.fill();

  for (let dot = 0; dot < 3; dot += 1) {
    const phase = (time / 420 + dot * 0.33) % 1;
    ctx.fillStyle = `rgba(255,255,255,${pulsing ? 0.35 + 0.55 * Math.max(0, Math.sin(phase * Math.PI)) : 0.6})`;
    ctx.beginPath();
    ctx.arc(
      left + width / 2 + (dot - 1) * fontSize * 0.44,
      top + height / 2,
      fontSize * 0.1,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  return { width, height };
}

/**
 * Messages — the lyric plays out as an iMessage thread. Lines become short
 * phrase bubbles, sides alternate per line, and the live bubble only ever holds
 * the words already sung.
 */
export const messages: LyricStyle = {
  id: 'messages',
  name: 'Native Design',
  description: 'The song as a message thread, a bubble for every phrase.',
  group: 'native',
  usesIcons: false,
  gradient: ['#0a84ff', '#05060a'],
  palette: {
    accent: OUT_BG,
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.45)',
    background: BLACK,
  },

  render(ctx, state) {
    const { width, height, positionMs, playing } = state;
    const reduceMotion = Boolean(state.reduceMotion);
    const calm = Boolean(state.photosensitive) || reduceMotion;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, width, height);

    const fontSize = Math.min(TYPE_MAX, Math.max(TYPE_MIN, Math.min(width, height) * 0.0245));
    const fonts: Fonts = {
      baseSize: fontSize,
      emphasisSize: fontSize * 1.08,
      base: fontOf(fontSize),
      emphasis: fontOf(fontSize * 1.08, 700),
      lineHeight: Math.round(fontSize * 1.42),
    };

    const columnWidth = Math.min(Math.max(320, width * 0.42), width - 24);
    const columnLeft = (width - columnWidth) / 2;
    const maxBubbleWidth = columnWidth * 0.75;
    const anchorY = height * 0.6;

    const trackKey = `${state.track.title}|${state.track.artist}`;
    const thread = threadAt({
      lines: state.lines,
      activeIndex: state.activeIndex,
      positionMs,
      playing,
      trackKey,
      maxItems: MAX_ITEMS,
    });

    const items = reduceMotion ? thread.items.filter((item) => item.complete) : thread.items;

    if (items.length === 0 && !thread.typing) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = fontOf(fontSize * 0.86);
      ctx.fillText(
        state.track.title ? 'waiting for the first line…' : 'play something on Spotify or Apple Music',
        width / 2,
        height / 2,
      );
      return;
    }

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    interface Entry {
      height: number;
      gap: number;
      side: Side;
      item?: ThreadItem;
      kind: 'phrase' | 'typing' | 'stamp';
      scale: number;
      alpha: number;
      top: number;
      layout?: BubbleLayout;
      bubbleWidth?: number;
    }

    const entries: Entry[] = [];
    const first = items[0];

    // The timestamp rides above the thread and scrolls away with it.
    if (first && first.phrase.lineIndex === 0 && first.phrase.phraseIndex === 0) {
      entries.push({
        height: fontSize * 1.7,
        gap: GAP_SIDE,
        side: 'in',
        kind: 'stamp',
        scale: 1,
        alpha: 1,
        top: 0,
      });
    }

    for (const item of items) {
      const current = layoutBubble(ctx, item, fonts, maxBubbleWidth - PAD_X * 2, item.revealed);
      let measuredWidth = current.width;
      let measuredHeight = current.height;

      // The active bubble springs from its size before this word landed.
      if (item.active && !reduceMotion && item.revealed > 1) {
        const before = layoutBubble(ctx, item, fonts, maxBubbleWidth - PAD_X * 2, item.revealed - 1);
        const lastWord = item.phrase.words[item.revealed - 1];
        const grow = easeOut(clamp01((positionMs - lastWord.startMs) / SPRING_MS));
        measuredWidth = before.width + (current.width - before.width) * grow;
        measuredHeight = before.height + (current.height - before.height) * grow;
      }

      const bubbleWidth = Math.max(fontSize * 2.2, measuredWidth);
      const fullHeight = Math.max(fontSize * 1.5, current.height);
      const previous = entries[entries.length - 1];
      const gap =
        previous && previous.kind === 'phrase' && previous.side === item.phrase.side
          ? GAP_SAME
          : GAP_SIDE;

      entries.push({
        // Stack on the full height so words landing never push the thread around.
        height: Math.max(fullHeight, measuredHeight),
        gap,
        side: item.phrase.side,
        item,
        kind: 'phrase',
        scale: reduceMotion
          ? 1
          : 0.9 + 0.1 * easeOut(clamp01((positionMs - item.phrase.startMs) / 160)),
        alpha: 1,
        top: 0,
        layout: current,
        bubbleWidth,
      });
    }

    if (thread.typing) {
      const previous = entries[entries.length - 1];
      entries.push({
        height: fontSize * 1.5,
        gap: previous && previous.kind === 'phrase' ? GAP_SIDE : GAP_SIDE,
        side: thread.typingSide,
        kind: 'typing',
        scale: reduceMotion ? 1 : 0.94,
        alpha: 1,
        top: 0,
      });
    }

    // Bottom-up stacking from the mid-screen anchor.
    let cursor = anchorY;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      cursor -= entry.height;
      entry.top = cursor;
      const distance = anchorY - cursor;
      entry.alpha = reduceMotion
        ? 1
        : Math.min(1, Math.max(0.18, 1 - distance / (height * 0.72)));
      if (index > 0) cursor -= entries[index - 1].gap;
    }

    entries.forEach((entry) => {
      const top = entry.top;
      ctx.globalAlpha = entry.alpha;

      if (entry.kind === 'stamp') {
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.textAlign = 'center';
        ctx.font = fontOf(fontSize * 0.78, 500);
        ctx.fillText(stampFor(trackKey), width / 2, top + entry.height / 2);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
        return;
      }

      if (entry.kind === 'typing') {
        const left =
          entry.side === 'out'
            ? columnLeft + columnWidth - fontSize * 2.4
            : columnLeft;
        drawTyping(ctx, left, top, fontSize, state.time, !calm && playing);
        ctx.globalAlpha = 1;
        return;
      }

      const item = entry.item;
      if (!item) {
        ctx.globalAlpha = 1;
        return;
      }

      const layout = entry.layout ?? layoutBubble(ctx, item, fonts, maxBubbleWidth - PAD_X * 2, item.revealed);
      const bubbleWidth = entry.bubbleWidth ?? Math.max(fontSize * 2.2, layout.width);
      const bubbleHeight = Math.max(fontSize * 1.5, layout.height);
      const left = entry.side === 'out' ? columnLeft + columnWidth - bubbleWidth : columnLeft;

      ctx.save();
      if (entry.scale !== 1) {
        const pivotX = entry.side === 'out' ? left + bubbleWidth : left;
        const pivotY = top + bubbleHeight;
        ctx.translate(pivotX, pivotY);
        ctx.scale(entry.scale, entry.scale);
        ctx.translate(-pivotX, -pivotY);
      }

      ctx.fillStyle = entry.side === 'out' ? OUT_BG : IN_BG;
      bubblePath(ctx, left, top, bubbleWidth, bubbleHeight);
      ctx.fill();

      if (item.phrase.tail) drawTail(ctx, entry.side, left, top, bubbleWidth, bubbleHeight);

      // Clip so the text can never escape while the bubble grows.
      ctx.save();
      bubblePath(ctx, left, top, bubbleWidth, bubbleHeight);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      layout.rows.forEach((row, rowIndex) => {
        const baseline = top + PAD_Y + rowIndex * fonts.lineHeight + fonts.lineHeight / 2;
        row.forEach((word) => {
          ctx.font = word.emphasis ? fonts.emphasis : fonts.base;
          ctx.fillText(word.text, left + PAD_X + word.x, baseline);
        });
      });
      ctx.restore();

      // Faint ring while the phrase is still being sung, fading as it lands.
      const lastWord = item.phrase.words[item.phrase.words.length - 1];
      const ringAlpha = reduceMotion
        ? 0
        : item.active
          ? 0.75
          : clamp01(1 - (positionMs - lastWord.endMs) / RING_FADE_MS);
      if (ringAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = ringAlpha * entry.alpha;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        if (!calm) {
          ctx.shadowColor = 'rgba(255,255,255,0.5)';
          ctx.shadowBlur = 10;
        }
        bubblePath(ctx, left - 1.5, top - 1.5, bubbleWidth + 3, bubbleHeight + 3);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    });

    // Soft fade over the top quarter: nothing hard-clips as the thread scrolls.
    const fade = ctx.createLinearGradient(0, 0, 0, height * 0.25);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, height * 0.25);
    ctx.restore();
  },
} as LyricStyle;
