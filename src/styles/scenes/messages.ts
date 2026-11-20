import type { LyricLine } from '../../types';
import { clamp01, type LyricStyle } from '../types';

const BLUE = '#0a84ff';
const MAX_BUBBLES = 5;

interface PlacedWord {
  text: string;
  startMs: number;
  endMs: number;
  x: number;
  width: number;
}

interface Row {
  words: PlacedWord[];
  width: number;
}

interface Bubble {
  line: LyricLine;
  rows: Row[];
  width: number;
  height: number;
  top: number;
  left: number;
  active: boolean;
}

function wordsOf(line: LyricLine): { text: string; startMs: number; endMs: number }[] {
  if (line.words.length > 0) return line.words;
  return [{ text: line.text, startMs: line.startMs, endMs: line.endMs }];
}

function wrap(
  ctx: CanvasRenderingContext2D,
  line: LyricLine,
  maxWidth: number,
): Row[] {
  const space = ctx.measureText(' ').width;
  const rows: Row[] = [];
  let current: Row = { words: [], width: 0 };

  for (const word of wordsOf(line)) {
    const width = ctx.measureText(word.text).width;
    const offset = current.words.length > 0 ? space : 0;

    if (current.width + offset + width > maxWidth && current.words.length > 0) {
      rows.push(current);
      current = { words: [], width: 0 };
    }

    const x = current.words.length > 0 ? current.width + space : 0;
    current.words.push({ text: word.text, startMs: word.startMs, endMs: word.endMs, x, width });
    current.width = x + width;
  }

  if (current.words.length > 0) rows.push(current);
  return rows;
}

function bubblePath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, radius);
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const right = left + width;
  const bottom = top + height;
  ctx.beginPath();
  ctx.moveTo(right - 12, bottom - 4);
  ctx.quadraticCurveTo(right + 6, bottom - 2, right + 4, bottom + 7);
  ctx.quadraticCurveTo(right - 4, bottom + 2, right - 10, bottom + 2);
  ctx.closePath();
  ctx.fill();
}

function drawTyping(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  fontSize: number,
  time: number,
): void {
  const width = fontSize * 2.1;
  const height = fontSize * 1.5;
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, height / 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let dot = 0; dot < 3; dot += 1) {
    const phase = (time / 420 + dot * 0.33) % 1;
    const alpha = 0.35 + 0.65 * Math.max(0, Math.sin(phase * Math.PI));
    const radius = fontSize * 0.11;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(
      left + width / 2 + (dot - 1) * fontSize * 0.42,
      top + height / 2,
      radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Messages — the lyric plays out as an iMessage text thread. Every line is a
 * blue bubble on the right, the newest one carrying the tail, and the words
 * inside the live bubble light up one at a time.
 */
export const messages: LyricStyle = {
  id: 'messages',
  name: 'Messages',
  description: 'The song plays out as an iMessage thread, one bubble per line.',
  group: 'scenes',
  usesIcons: false,
  gradient: ['#0a84ff', '#05060a'],
  palette: {
    accent: BLUE,
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.45)',
    background: '#000000',
  },

  render(ctx, state) {
    const { width, height, time, positionMs } = state;

    ctx.clearRect(0, 0, width, height);

    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#000000');
    background.addColorStop(1, '#06080e');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const fontSize = Math.min(34, Math.max(14, Math.min(width, height) * 0.082));
    const lineHeight = fontSize * 1.34;
    const padX = fontSize * 0.62;
    const padY = fontSize * 0.4;
    const gap = fontSize * 0.3;
    const marginX = Math.max(16, width * 0.055);
    const maxBubbleWidth = width * 0.74;
    const bottom = height - Math.max(16, height * 0.07);

    ctx.font = `500 ${fontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const index = state.activeIndex;

    if (index < 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      ctx.textAlign = 'center';
      ctx.font = `500 ${fontSize * 0.8}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(
        state.track.title ? 'waiting for the first line…' : 'play something on Spotify or Apple Music',
        width / 2,
        height / 2,
      );
      return;
    }

    const first = Math.max(0, index - (MAX_BUBBLES - 1));
    const bubbles: Bubble[] = [];

    for (let lineIndex = first; lineIndex <= index; lineIndex += 1) {
      const line = state.lines[lineIndex];
      const rows = wrap(ctx, line, maxBubbleWidth - padX * 2);
      const contentWidth = rows.reduce((widest, row) => Math.max(widest, row.width), 0);
      bubbles.push({
        line,
        rows,
        width: Math.max(contentWidth + padX * 2, fontSize * 2.2),
        height: rows.length * lineHeight + padY * 2,
        top: 0,
        left: 0,
        active: lineIndex === index,
      });
    }

    // Bottom-align the thread.
    let cursor = bottom;
    for (let index = bubbles.length - 1; index >= 0; index -= 1) {
      const bubble = bubbles[index];
      bubble.top = cursor - bubble.height;
      bubble.left = width - marginX - bubble.width;
      cursor = bubble.top - gap;
    }

    const line = state.lines[index];
    const showTyping =
      state.playing && positionMs > line.endMs && positionMs < line.endMs + 4000 && line.text.length > 0;

    bubbles.forEach((bubble, order) => {
      const age = bubbles.length - 1 - order;
      const alpha = bubble.active ? 1 : Math.max(0.34, 0.92 - age * 0.16);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = BLUE;
      bubblePath(ctx, bubble.left, bubble.top, bubble.width, bubble.height, fontSize * 0.95);
      ctx.fill();

      if (bubble.active && !showTyping) {
        drawTail(ctx, bubble.left, bubble.top, bubble.width, bubble.height);
      }

      bubble.rows.forEach((row, rowIndex) => {
        const baseline = bubble.top + padY + rowIndex * lineHeight + lineHeight * 0.5;
        row.words.forEach((word) => {
          const x = bubble.left + padX + word.x;
          const isActive =
            state.positionMs >= word.startMs &&
            state.positionMs < word.endMs &&
            positionMs < line.endMs + 250;
          const sung = positionMs >= word.endMs;

          if (isActive) {
            const pillWidth = word.width + fontSize * 0.24;
            ctx.fillStyle = 'rgba(255,255,255,0.96)';
            ctx.beginPath();
            ctx.roundRect(
              x - fontSize * 0.12,
              baseline - lineHeight * 0.46,
              pillWidth,
              lineHeight * 0.92,
              fontSize * 0.22,
            );
            ctx.fill();
            ctx.fillStyle = BLUE;
          } else if (bubble.active) {
            ctx.fillStyle = sung ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.5)';
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
          }

          ctx.fillText(word.text, x, baseline);
        });
      });

      ctx.globalAlpha = 1;
    });

    if (showTyping) {
      const lastBubble = bubbles[bubbles.length - 1];
      const typingWidth = fontSize * 2.1;
      drawTyping(
        ctx,
        width - marginX - typingWidth,
        lastBubble.top + lastBubble.height + gap * 0.6,
        fontSize,
        time,
      );
      drawTail(
        ctx,
        width - marginX - typingWidth,
        lastBubble.top + lastBubble.height + gap * 0.6,
        typingWidth,
        fontSize * 1.5,
      );
    }

    // Quiet progress tick under the thread.
    const progress = clamp01(state.lineProgress);
    if (progress > 0) {
      const barWidth = Math.min(width - marginX * 2, 220);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(width - marginX - barWidth, bottom + gap * 0.4, barWidth, 2);
      ctx.fillStyle = BLUE;
      ctx.fillRect(width - marginX - barWidth, bottom + gap * 0.4, barWidth * progress, 2);
      ctx.globalAlpha = 1;
    }
  },
};
