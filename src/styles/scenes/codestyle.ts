import { iconFor } from '../icons';
import { clamp01, type LyricStyle, type StyleState } from '../types';

const KEYWORD = '#ff7ab2';
const FUNC = '#7dd3fc';
const STRING = '#c3e88d';
const PUNCT = 'rgba(255,255,255,0.45)';
const COMMENT = 'rgba(255,255,255,0.32)';
const CURSOR = '#ff4d5e';

/**
 * Codestyle — the lyric is typed out as source code, with a blinking red
 * cursor. With `withIcons` each word that has a picture is annotated inline,
 * which is the Codestyle Visual variant.
 */
export function makeCodestyle(withIcons: boolean): LyricStyle {
  return {
    id: withIcons ? 'codestyle-visual' : 'codestyle',
    name: withIcons ? 'Codestyle Visual' : 'Codestyle',
    description: withIcons
      ? 'Codestyle, with icons beside the words that have one.'
      : 'The lyric typed out as code, with a blinking red cursor.',
    group: 'scenes',
    usesIcons: withIcons,
    gradient: withIcons ? ['#1a1b26', '#414868'] : ['#111318', '#20242e'],
    palette: {
      accent: '#c3e88d',
      text: '#e6e8ee',
      dim: 'rgba(255,255,255,0.3)',
      background: '#0b0d12',
    },

    render(ctx, state) {
      const { width, height, palette } = state;
      ctx.clearRect(0, 0, width, height);

      const paper = ctx.createLinearGradient(0, 0, width, height);
      paper.addColorStop(0, '#0b0d12');
      paper.addColorStop(1, '#141824');
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, width, height);

      const fontSize = Math.min(26, Math.max(13, width / 34));
      const lineHeight = fontSize * 1.75;
      const gutter = Math.round(fontSize * 3.2);
      const top = Math.max(lineHeight * 1.6, height * 0.16);
      const left = gutter + fontSize * 1.2;

      // Editor chrome: title bar comment.
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `500 ${fontSize * 0.82}px "Cascadia Mono", Consolas, monospace`;
      ctx.fillStyle = COMMENT;
      ctx.fillText(`// ${state.track.title || 'lyrica'} — ${state.track.artist || 'waiting for a track'}`, left, top - lineHeight * 1.35);

      const visible = Math.max(3, Math.floor((height - top * 1.4) / lineHeight));
      const end = state.activeIndex >= 0 ? state.activeIndex : 0;
      const start = Math.max(0, end - visible + 2);

      for (let index = start; index <= end && index < state.lines.length; index += 1) {
        const line = state.lines[index];
        const y = top + (index - start) * lineHeight;
        const isActive = index === state.activeIndex;

        // Line number gutter.
        ctx.fillStyle = isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)';
        ctx.font = `500 ${fontSize}px "Cascadia Mono", Consolas, monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(String(index + 1).padStart(2, '0'), gutter, y);
        ctx.textAlign = 'left';

        drawCodeLine(ctx, line.words, isActive ? state : null, left, y, fontSize, withIcons, palette.accent);
      }

      // Faint scroll shadow at the top of the editor.
      const fade = ctx.createLinearGradient(0, 0, 0, top);
      fade.addColorStop(0, 'rgba(11,13,18,0.95)');
      fade.addColorStop(1, 'rgba(11,13,18,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, top);
    },
  };
}

function drawCodeLine(
  ctx: CanvasRenderingContext2D,
  words: { text: string; startMs: number; endMs: number }[],
  active: StyleState | null,
  x0: number,
  y: number,
  fontSize: number,
  withIcons: boolean,
  accent: string,
): void {
  const mono = `500 ${fontSize}px "Cascadia Mono", Consolas, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  let x = x0;

  ctx.font = mono;
  ctx.fillStyle = KEYWORD;
  ctx.fillText('await', x, y);
  x += ctx.measureText('await ').width;

  ctx.fillStyle = FUNC;
  ctx.fillText('sing', x, y);
  x += ctx.measureText('sing').width;

  ctx.fillStyle = PUNCT;
  ctx.fillText('(', x, y);
  x += ctx.measureText('(').width;

  ctx.fillStyle = STRING;
  ctx.fillText('"', x, y);
  x += ctx.measureText('"').width;

  const opacity = active ? 1 : 0.34;
  ctx.globalAlpha = opacity;

  const text = words.length > 0 ? words : [];
  let cursorX = x;

  text.forEach((word, index) => {
    const typed = active ? active.wordIndex >= index : true;
    const partial = active && active.wordIndex === index ? clamp01(active.wordProgress) : 1;
    const isActive = active !== null && active.wordIndex === index;

    if (!typed && !isActive) {
      ctx.globalAlpha = 0.12;
    }

    if (withIcons) {
      const icon = iconFor(word.text);
      if (icon) {
        ctx.font = `${fontSize * 0.9}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
        ctx.globalAlpha = opacity * (isActive ? 1 : 0.7);
        ctx.fillText(icon, x, y);
        x += ctx.measureText(icon).width + fontSize * 0.25;
        ctx.font = mono;
      }
    }

    const visibleText =
      isActive && partial < 1
        ? word.text.slice(0, Math.max(1, Math.ceil(word.text.length * partial)))
        : word.text;

    ctx.font = mono;
    ctx.fillStyle = isActive ? accent : STRING;
    ctx.globalAlpha = opacity * (isActive ? 1 : typed ? 0.95 : 0.2);
    ctx.fillText(visibleText, x, y);

    const fullWidth = ctx.measureText(word.text).width;
    if (isActive) {
      cursorX = x + ctx.measureText(visibleText).width;
      // Block cursor while the word is being typed.
      const blink = Math.floor(performance.now() / 480) % 2 === 0;
      if (blink && partial < 1) {
        ctx.fillStyle = CURSOR;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(cursorX + 1, y - fontSize * 0.6, fontSize * 0.52, fontSize * 1.2);
      }
    }

    x += fullWidth;
    if (index < text.length - 1) {
      x += ctx.measureText(' ').width;
      ctx.fillStyle = STRING;
      ctx.globalAlpha = active && active.wordIndex < index ? 0.2 : opacity;
      ctx.fillText(' ', x - ctx.measureText(' ').width, y);
    }
  });

  ctx.globalAlpha = opacity;
  ctx.fillStyle = STRING;
  ctx.fillText('"', x, y);
  x += ctx.measureText('"').width;

  ctx.fillStyle = PUNCT;
  ctx.fillText(')', x, y);
  x += ctx.measureText(')').width;
  ctx.fillText(';', x, y);

  if (active && !text.length) {
    const blink = Math.floor(performance.now() / 480) % 2 === 0;
    if (blink) {
      ctx.fillStyle = CURSOR;
      ctx.fillRect(x + 3, y - fontSize * 0.6, fontSize * 0.52, fontSize * 1.2);
    }
  }

  ctx.globalAlpha = 1;
}

export const codestyle = makeCodestyle(false);
export const codestyleVisual = makeCodestyle(true);
