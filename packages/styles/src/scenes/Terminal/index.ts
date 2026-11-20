import type { LyricStyle } from '../../types';
import { placeholder } from '../../lib/draw';
import { activeLine, fontOf } from '../../lib/text';
import { blinkOn, commandTyped, logsFor } from './model';

const MONO = '"Cascadia Code", "Consolas", "Courier New", monospace';

/**
 * Terminal — the lyric is typed into a shell prompt, with harmless log output
 * scrolling beside it and a blinking cursor.
 */
export const terminal: LyricStyle = {
  id: 'terminal',
  name: 'Terminal',
  description: 'The lyric typed into a command prompt.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'ls lyric',
  isNew: true,
  usesIcons: false,
  gradient: ['#04120a', '#3df58a'],
  palette: {
    accent: '#3df58a',
    text: '#d6ffe8',
    dim: 'rgba(214,255,232,0.4)',
    background: '#04120a',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#04120a';
    ctx.fillRect(0, 0, width, height);

    const line = activeLine(state.lines, state.activeIndex);
    if (!line) {
      placeholder(ctx, state, 'lyrica@desktop:~$ play something');
      return;
    }

    const size = Math.max(14, Math.min(height * 0.075, width / 22));
    ctx.font = fontOf(size, 500, MONO);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // Session chrome.
    const pad = size * 1.4;
    ctx.fillStyle = 'rgba(61,245,138,0.08)';
    ctx.fillRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.strokeStyle = 'rgba(61,245,138,0.25)';
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

    ctx.fillStyle = palette.dim;
    ctx.font = fontOf(size * 0.8, 500, MONO);
    ctx.fillText(`lyrica — ${state.track.artist || 'session'}`, pad * 1.6, pad * 1.7);
    ctx.fillStyle = 'rgba(61,245,138,0.5)';
    ctx.fillText('●  ●  ●', width - pad * 5, pad * 1.7);

    // Log column, dim and to the right.
    const logs = logsFor(state.activeIndex, 4);
    ctx.font = fontOf(size * 0.72, 400, MONO);
    logs.forEach((entry, index) => {
      ctx.fillStyle = `rgba(61,245,138,${0.28 - index * 0.04})`;
      ctx.fillText(entry, width * 0.62, height * 0.24 + index * size * 1.1);
    });

    // The prompt and the typed lyric.
    const prompt = 'lyrica@desktop:~$';
    ctx.font = fontOf(size, 500, MONO);
    ctx.fillStyle = palette.accent;
    ctx.fillText(prompt, pad * 1.6, height * 0.55);

    const promptWidth = ctx.measureText(`${prompt} `).width;
    const maxWidth = width - pad * 2 - promptWidth - pad * 1.6;
    const typed = commandTyped(line.text, state.lineProgress);
    ctx.font = fontOf(size, 600, MONO);

    // Wrap the typed command like a real terminal.
    const words = typed.split(' ');
    let row = 0;
    let cursorX = pad * 1.6 + promptWidth;
    let cursorY = height * 0.55;
    for (const word of words) {
      const width_ = ctx.measureText(`${word} `).width;
      if (cursorX + width_ > pad * 1.6 + promptWidth + maxWidth) {
        row += 1;
        cursorX = pad * 1.6 + promptWidth;
        cursorY += size * 1.3;
      }
      ctx.fillStyle = cursorX === pad * 1.6 + promptWidth && row > 0 ? palette.accent : palette.text;
      ctx.fillText(word, cursorX, cursorY);
      cursorX += width_;
    }

    if (blinkOn(state.time)) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(cursorX + 2, cursorY - size * 0.45, size * 0.5, size * 0.9);
    }

    // Progress of the line as an exit code line.
    ctx.font = fontOf(size * 0.72, 400, MONO);
    ctx.fillStyle = palette.dim;
    ctx.fillText(`[${Math.round(state.lineProgress * 100)}%] ${row + 1} line(s)`, pad * 1.6, height - pad * 1.6);
  },
};
