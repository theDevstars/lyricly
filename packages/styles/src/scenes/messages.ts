import { clamp01, wordGap, type LyricStyle } from '../types';
import {
  GHOST_LEAD_MS,
  threadAt,
  wordState,
  type PhraseWord,
  type Side,
  type ThreadItem,
} from './messagesModel';

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
const RING_FADE_MS = 250;
const MAX_ITEMS = 12;

/** Pop size by intensity. Deliberately bigger than a polite 1.25. */
const POP_SCALE: Record<string, number> = { subtle: 1.18, normal: 1.34, strong: 1.52 };
const POP_MS = 190;
const FAST_POP_MS = 120;
const SETTLE_MS = 160;

type WordAnimation = 'ghost-pop' | 'pop-only' | 'fade' | 'off';

const fontOf = (size: number, weight = 500): string =>
  `${weight} ${size}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;

const easeOut = (value: number): number => 1 - (1 - value) ** 3;
/** Springy pop with real overshoot: energy, not a polite scale. */
const easeOutBack = (value: number): number => {
  const s = 3.6;
  const p = value - 1;
  return 1 + (s + 1) * p * p * p + s * p * p;
};

/** Saved values from earlier builds map onto the new names. */
function animationOf(value: unknown): WordAnimation {
  const key = String(value ?? '').toLowerCase();
  if (key === 'off' || key === 'none' || key === 'false') return 'off';
  if (key === 'fade' || key === 'fade-only') return 'fade';
  if (key === 'pop' || key === 'pop-only') return 'pop-only';
  return 'ghost-pop';
}

function intensityOf(value: unknown): string {
  const key = String(value ?? '').toLowerCase();
  return key in POP_SCALE ? key : 'normal';
}

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** Ghosts lean toward the bubble colour, so they read as "not mine yet". */
const tint = (text: string, bubble: string, amount: number): string => {
  const [tr, tg, tb] = hexToRgb(text);
  const [br, bg, bb] = hexToRgb(bubble);
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * amount);
  return `rgb(${mix(tr, br)}, ${mix(tg, bg)}, ${mix(tb, bb)})`;
};

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

interface WordBox {
  text: string;
  x: number;
  width: number;
}

interface PhraseLayout {
  boxes: WordBox[];
  rowOf: number[];
  width: number;
  height: number;
}

interface Fonts {
  baseSize: number;
  emphasisSize: number;
  base: string;
  bold: string;
  lineHeight: number;
}

/**
 * Lays out the FULL phrase once. Word boxes never move after this: the bubble
 * is pre-sized to its final text and words animate inside their reserved slots.
 */
function layoutPhrase(
  ctx: CanvasRenderingContext2D,
  words: PhraseWord[],
  fonts: Fonts,
  maxWidth: number,
): PhraseLayout {
  // Measure the space with the base font: a leftover bold font from the last
  // bubble would shift every word.
  ctx.font = fonts.base;
  const space = ctx.measureText(' ').width;
  const boxes: WordBox[] = [];
  const rowOf: number[] = [];
  let row = 0;
  let cursor = 0;
  let widest = 0;

  words.forEach((word, index) => {
    const width = ctx.measureText(word.text).width;
    let x = 0;
    if (index > 0) {
      const previous = words[index - 1].text;
      const gap = wordGap(previous, word.text, space);
      const lastBox = boxes[index - 1];
      if (lastBox && lastBox.x + lastBox.width + gap + width <= maxWidth) x = lastBox.x + lastBox.width + gap;
      else {
        row += 1;
        x = 0;
      }
    }
    if (x === 0 && index > 0 && boxes[index - 1]) {
      // first word of a new row
      cursor = 0;
    }
    boxes.push({ text: word.text, x, width });
    rowOf.push(row);
    cursor = x + width;
    widest = Math.max(widest, cursor);
  });

  return {
    boxes,
    rowOf,
    width: widest + PAD_X * 2,
    height: (row + 1) * fonts.lineHeight + PAD_Y * 2,
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
): void {
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
}

interface WordLook {
  scale: number;
  y: number;
  blur: number;
  alpha: number;
  bold: number;
  glow: number;
}

/**
 * One word's look at this instant: ghost, the pop, or settled. Only the pop
 * uses a spring; the settle is a clean ease-out.
 */
function lookOf(
  word: PhraseWord,
  index: number,
  words: PhraseWord[],
  positionMs: number,
  mode: WordAnimation,
  pop: number,
  calm: boolean,
): WordLook | null {
  const state = wordState(positionMs, word, words[index - 1], words[index + 1]);

  if (mode === 'off') {
    return positionMs < word.startMs
      ? null
      : { scale: 1, y: 0, blur: 0, alpha: 1, bold: 0, glow: 0 };
  }

  if (mode === 'fade' || calm) {
    if (positionMs < word.startMs) return null;
    return {
      scale: 1,
      y: 0,
      blur: 0,
      alpha: clamp01((positionMs - word.startMs) / 100),
      bold: 0,
      glow: 0,
    };
  }

  if (state.phase === 'hidden') return null;

  if (state.phase === 'ghost' && mode !== 'pop-only') {
    const toStart = clamp01(1 - (word.startMs - positionMs) / Math.max(1, state.leadMs));
    return {
      scale: 0.6 + 0.04 * toStart,
      y: 3,
      blur: 3,
      alpha: 0.35,
      bold: 0,
      glow: 0,
    };
  }

  const popMs = state.fast ? FAST_POP_MS : POP_MS;
  const spring = easeOutBack(clamp01((positionMs - word.startMs) / popMs));
  const settle = clamp01((positionMs - state.settleAtMs) / SETTLE_MS);
  const easedSettle = easeOut(settle);

  let scale = 0.6 + (pop - 0.6) * spring;
  scale = scale + (1 - scale) * easedSettle;
  let y = 3 - 5.5 * spring + 2.5 * easedSettle;
  const blur = state.phase === 'ghost' ? 3 : 3 * (1 - clamp01((positionMs - word.startMs) / 90));
  const alpha = state.phase === 'ghost' ? 0.35 : 0.35 + 0.65 * clamp01((positionMs - word.startMs) / 70);

  // Long held words breathe instead of freezing at full size.
  if (state.held && !calm && state.phase === 'active') {
    const pulse = Math.sin(((positionMs - word.startMs) / 1200) * Math.PI * 2);
    scale *= 1 + 0.04 * pulse;
    y -= 0.8 * pulse;
  }

  return {
    scale,
    y,
    blur,
    alpha,
    bold: 1 - easedSettle,
    glow: state.phase === 'active' ? 1 - settle : 0,
  };
}

function drawPhraseWords(
  ctx: CanvasRenderingContext2D,
  item: ThreadItem,
  layout: PhraseLayout,
  fonts: Fonts,
  left: number,
  top: number,
  positionMs: number,
  mode: WordAnimation,
  pop: number,
  calm: boolean,
  bubbleColor: string,
): void {
  const words = item.phrase.words;
  const ghostColor = tint('#ffffff', bubbleColor, 0.3);

  words.forEach((word, index) => {
    const look = lookOf(word, index, words, positionMs, mode, pop, calm);
    if (!look) return;
    const box = layout.boxes[index];
    if (!box) return;

    const baseline = top + PAD_Y + layout.rowOf[index] * fonts.lineHeight + fonts.lineHeight * 0.72;
    const x = left + PAD_X + box.x;

    ctx.save();
    ctx.globalAlpha *= look.alpha;
    ctx.translate(x, baseline);
    ctx.scale(look.scale, look.scale);

    if (look.blur > 0.05) ctx.filter = `blur(${look.blur.toFixed(2)}px)`;
    ctx.fillStyle = look.bold > 0.5 ? '#ffffff' : ghostColor;
    if (look.glow > 0 && !calm) {
      ctx.shadowColor = `rgba(255,255,255,${0.5 * look.glow})`;
      ctx.shadowBlur = 16 * look.glow;
    }

    if (look.bold > 0 && look.bold < 1) {
      // Crossfade the weight instead of snapping it: no reflow, no flicker.
      ctx.globalAlpha *= 1 - look.bold;
      ctx.font = fonts.base;
      ctx.fillText(word.text, 0, look.y);
      ctx.globalAlpha /= 1 - look.bold;
      ctx.globalAlpha *= look.bold;
      ctx.font = fonts.bold;
      ctx.fillText(word.text, 0, look.y);
    } else {
      ctx.font = look.bold >= 1 ? fonts.bold : fonts.base;
      ctx.fillText(word.text, 0, look.y);
    }

    ctx.restore();
  });
}

/**
 * Messages — the lyric plays out as an iMessage thread. Each bubble is sized to
 * its whole phrase up front, and every word inside it ghosts in, pops, then
 * settles back into its reserved slot.
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
    const mode: WordAnimation = reduceMotion
      ? 'fade'
      : animationOf(state.styleOptions?.wordAnimation);
    const pop = POP_SCALE[intensityOf(state.styleOptions?.popIntensity)];

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, width, height);

    const fontSize = Math.min(TYPE_MAX, Math.max(TYPE_MIN, Math.min(width, height) * 0.0245));
    const fonts: Fonts = {
      baseSize: fontSize,
      emphasisSize: fontSize * 1.1,
      base: fontOf(fontSize),
      bold: fontOf(fontSize, 700),
      // Roomy rows: a 1.5x pop must not crash into the row above.
      lineHeight: Math.round(fontSize * 1.62),
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

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    interface Entry {
      height: number;
      gap: number;
      side: Side;
      item?: ThreadItem;
      kind: 'phrase' | 'typing' | 'stamp';
      alpha: number;
      top: number;
      layout?: PhraseLayout;
      bubbleWidth?: number;
      bubbleColor?: string;
    }

    const entries: Entry[] = [];
    const first = items[0];

    if (first && first.phrase.lineIndex === 0 && first.phrase.phraseIndex === 0) {
      entries.push({
        height: fontSize * 1.7,
        gap: GAP_SIDE,
        side: 'in',
        kind: 'stamp',
        alpha: 1,
        top: 0,
      });
    }

    for (const item of items) {
      const layout = layoutPhrase(ctx, item.phrase.words, fonts, maxBubbleWidth - PAD_X * 2);
      const bubbleWidth = Math.max(fontSize * 2.2, layout.width);
      const bubbleHeight = Math.max(fontSize * 1.5, layout.height);
      const previous = entries[entries.length - 1];
      const gap =
        previous && previous.kind === 'phrase' && previous.side === item.phrase.side
          ? GAP_SAME
          : GAP_SIDE;

      entries.push({
        height: bubbleHeight,
        gap,
        side: item.phrase.side,
        item,
        kind: 'phrase',
        alpha: 1,
        top: 0,
        layout,
        bubbleWidth,
        bubbleColor: item.phrase.side === 'out' ? OUT_BG : IN_BG,
      });
    }

    if (thread.typing) {
      entries.push({
        height: fontSize * 1.5,
        gap: GAP_SIDE,
        side: thread.typingSide,
        kind: 'typing',
        alpha: 1,
        top: 0,
      });
    }

    // Bottom-up stacking from the mid-screen anchor. Heights are final sizes, so
    // nothing in the thread shifts as words land.
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
        ctx.textBaseline = 'middle';
        ctx.font = fontOf(fontSize * 0.78, 500);
        ctx.fillText(stampFor(trackKey), width / 2, top + entry.height / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = 1;
        return;
      }

      if (entry.kind === 'typing') {
        const left =
          entry.side === 'out' ? columnLeft + columnWidth - fontSize * 2.4 : columnLeft;
        drawTyping(ctx, left, top, fontSize, state.time, !calm && playing);
        ctx.globalAlpha = 1;
        return;
      }

      const item = entry.item;
      const layout = entry.layout;
      if (!item || !layout) {
        ctx.globalAlpha = 1;
        return;
      }

      const bubbleWidth = entry.bubbleWidth ?? layout.width;
      const bubbleHeight = entry.height;
      const bubbleColor = entry.bubbleColor ?? IN_BG;
      const left = entry.side === 'out' ? columnLeft + columnWidth - bubbleWidth : columnLeft;

      // The bubble slides up into place and fades in over 150ms.
      const appearAt = item.phrase.startMs - GHOST_LEAD_MS;
      const entrance = reduceMotion ? 1 : clamp01((positionMs - appearAt) / 150);
      const slide = (1 - easeOut(entrance)) * 6;
      const drawTop = top + slide;
      const bubbleAlpha = entry.alpha * entrance;

      ctx.globalAlpha = bubbleAlpha;

      ctx.fillStyle = bubbleColor;
      bubblePath(ctx, left, drawTop, bubbleWidth, bubbleHeight);
      ctx.fill();
      if (item.phrase.tail) drawTail(ctx, entry.side, left, drawTop, bubbleWidth, bubbleHeight);

      // Thin ring, offset outward, visible from the moment the bubble appears.
      const lastWord = item.phrase.words[item.phrase.words.length - 1];
      const ringFade = item.complete
        ? clamp01(1 - (positionMs - lastWord.endMs) / RING_FADE_MS)
        : 1;
      if (ringFade > 0.01) {
        ctx.save();
        ctx.globalAlpha = bubbleAlpha * ringFade * 0.34;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        if (!calm) {
          ctx.shadowColor = 'rgba(255,255,255,0.45)';
          ctx.shadowBlur = 10;
        }
        bubblePath(ctx, left - 6, drawTop - 6, bubbleWidth + 12, bubbleHeight + 12);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      bubblePath(ctx, left, drawTop, bubbleWidth, bubbleHeight);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      drawPhraseWords(
        ctx,
        item,
        layout,
        fonts,
        left,
        drawTop,
        positionMs,
        mode,
        pop,
        calm,
        bubbleColor,
      );
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
