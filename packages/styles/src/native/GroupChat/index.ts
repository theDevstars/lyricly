import type { LyricStyle } from '../../types';
import { rrect } from '../../lib/draw';
import { activeLine, fontOf } from '../../lib/text';
import { detectSections } from '../../lib/sections';
import { REACTIONS, authorOf, stamp, windowOf } from './model';

/**
 * Group Chat — the song as a chat room: each line is a message from an invented
 * member, with avatars, timestamps and reactions that pop on the chorus.
 */
export const groupChat: LyricStyle = {
  id: 'group-chat',
  name: 'Native Design Group Chat',
  description: 'The song as a chat room, with reactions on the chorus.',
  group: 'native',
  eyebrow: 'Native Design',
  sample: 'hey',
  isNew: true,
  defaultEffects: ['beat'],
  usesIcons: false,
  gradient: ['#101322', '#5865f2'],
  palette: {
    accent: '#5865f2',
    text: '#e9ecf8',
    dim: 'rgba(233,236,248,0.4)',
    background: '#0d1020',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, width, height);

    if (activeLine(state.lines, state.activeIndex) === null) {
      ctx.fillStyle = palette.dim;
      ctx.font = fontOf(Math.min(20, width / 34), 500);
      ctx.textAlign = 'center';
      ctx.fillText('# listening — play a track', width / 2, height / 2);
      return;
    }

    const sections = detectSections(state.lines);
    const ids = windowOf(state.lines.length, state.activeIndex, 5);
    const size = Math.max(12, Math.min(height * 0.045, width / 30));
    const pad = size * 1.4;
    const rowHeight = size * 3.2;
    const top = height - pad - ids.length * rowHeight;

    // Channel chrome.
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, width, size * 3.4);
    ctx.fillStyle = palette.text;
    ctx.font = fontOf(size, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('# now-playing', pad, size * 1.7);

    ids.forEach((lineIndex, slot) => {
      const line = state.lines[lineIndex];
      const author = authorOf(lineIndex);
      const y = top + slot * rowHeight + rowHeight / 2;
      const active = lineIndex === state.activeIndex;

      // Avatar.
      ctx.fillStyle = author.color;
      ctx.beginPath();
      ctx.arc(pad + size, y, size * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d1020';
      ctx.font = fontOf(size * 0.95, 800);
      ctx.textAlign = 'center';
      ctx.fillText(author.initials, pad + size, y);

      // Name and stamp.
      ctx.textAlign = 'left';
      ctx.font = fontOf(size, 700);
      ctx.fillStyle = author.color;
      ctx.fillText(author.name, pad + size * 2.6, y - size * 0.62);
      ctx.font = fontOf(size * 0.78, 400);
      ctx.fillStyle = palette.dim;
      ctx.fillText(stamp(line.startMs), pad + size * 2.6 + ctx.measureText(author.name).width * 1.9, y - size * 0.62);

      // Message bubble.
      ctx.font = fontOf(size, active ? 600 : 400);
      const text = line.text || '…';
      const textWidth = Math.min(width - pad * 2 - size * 3, ctx.measureText(text).width);
      if (active) {
        ctx.fillStyle = 'rgba(88,101,242,0.22)';
        rrect(ctx, pad + size * 2.2, y - size * 0.2, textWidth + pad, size * 1.9, size * 0.8);
        ctx.fill();
      }
      ctx.fillStyle = active ? palette.text : 'rgba(233,236,248,0.72)';
      ctx.fillText(text, pad + size * 2.6, y + size * 0.62);

      // Chorus reactions.
      const chorus = sections[lineIndex]?.chorus;
      if (chorus && active) {
        ctx.font = fontOf(size * 0.95, 400);
        REACTIONS.forEach((emoji, index) => {
          const drift = Math.sin(state.time / 420 + index) * size * 0.12;
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          rrect(ctx, width - pad - (REACTIONS.length - index) * size * 1.9, y - size * 1.5 + drift, size * 1.7, size * 1.2, size * 0.6);
          ctx.fill();
          ctx.fillText(emoji, width - pad - (REACTIONS.length - index) * size * 1.9 + size * 0.3, y - size * 0.9 + drift);
        });
      }
    });

    // Typing indicator while the line is still going.
    if (state.lineProgress < 0.9) {
      const dots = 1 + (Math.floor(state.time / 320) % 3);
      ctx.fillStyle = palette.dim;
      ctx.font = fontOf(size * 0.85, 400);
      ctx.textAlign = 'left';
      ctx.fillText(`${authorOf(state.activeIndex).name} is typing${'.'.repeat(dots)}`, pad + size * 2.6, height - pad * 0.6);
    }
  },
};
