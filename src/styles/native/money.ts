import { clamp01, type LyricStyle } from '../types';

const NAMES = ['Mara', 'Idris', 'Juno', 'Kai', 'Noor', 'Pia', 'Rex', 'Sana', 'Theo', 'Wren'];
const GREEN = '#3ddc84';
const SURFACE = 'rgba(17,23,20,0.94)';
const CARD = 'rgba(23,30,26,0.96)';

function seedFor(text: string, salt: number): number {
  let hash = salt >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export const money: LyricStyle = {
  id: 'money',
  name: 'Native Design Money',
  description: 'The song as a run of payments, one for every line.',
  group: 'native',
  usesIcons: false,
  gradient: ['#07120c', '#1f6b46'],
  palette: {
    accent: GREEN,
    text: '#f2fff6',
    dim: 'rgba(255,255,255,0.42)',
    background: '#050a07',
  },

  render(ctx, state) {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#060d09');
    backdrop.addColorStop(1, '#030604');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const cardWidth = Math.min(width * 0.72, 720);
    const left = (width - cardWidth) / 2;
    const cardHeight = Math.min(104, height * 0.16);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PAYMENTS · TODAY', left, height * 0.12);

    const index = state.activeIndex;
    if (index < 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? 'Waiting for the first line…' : 'Nothing playing', width / 2, height / 2);
      return;
    }

    const from = Math.max(0, index - 2);
    let slot = 0;

    for (let lineIndex = index; lineIndex >= from; lineIndex -= 1) {
      const line = state.lines[lineIndex];
      if (!line) continue;

      const active = lineIndex === index;
      const y = height * 0.2 + slot * (cardHeight + 18);
      slot += 1;

      const seed = seedFor(line.text, lineIndex + 7);
      const recipient = NAMES[seed % NAMES.length];
      const amount = ((seed % 4200) / 100 + 4).toFixed(2);
      const words = line.words.length > 0
        ? line.words
        : [{ text: line.text, startMs: line.startMs, endMs: line.endMs }];

      // Card.
      rounded(ctx, left, y, cardWidth, cardHeight, 18);
      ctx.fillStyle = active ? CARD : SURFACE;
      ctx.globalAlpha = active ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (active) {
        ctx.strokeStyle = 'rgba(61,220,132,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Avatar.
      const avatarX = left + 44;
      const avatarY = y + cardHeight / 2;
      const avatar = ctx.createLinearGradient(avatarX - 20, avatarY - 20, avatarX + 20, avatarY + 20);
      avatar.addColorStop(0, '#1f6b46');
      avatar.addColorStop(1, '#0d3a26');
      ctx.fillStyle = avatar;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9ffe9';
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(recipient.slice(0, 1), avatarX, avatarY + 1);

      // Names.
      ctx.textAlign = 'left';
      ctx.fillStyle = active ? '#f2fff6' : 'rgba(242,255,246,0.7)';
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(recipient, left + 78, y + 26);

      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(active ? 'Paying now' : 'Paid', left + 78, y + cardHeight - 24);

      // Memo: the lyric, typed word by word on the active card.
      let memo = line.text;
      if (active && state.wordIndex >= 0) {
        const typed = words
          .slice(0, state.wordIndex + 1)
          .map((word, position) =>
            position === state.wordIndex
              ? word.text.slice(0, Math.max(1, Math.ceil(word.text.length * clamp01(state.wordProgress))))
              : word.text,
          )
          .join(' ');
        memo = typed;
      }

      ctx.fillStyle = active ? 'rgba(242,255,246,0.92)' : 'rgba(242,255,246,0.55)';
      ctx.font = '500 16px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
      const memoMax = cardWidth - 260;
      let shown = memo;
      while (ctx.measureText(shown).width > memoMax && shown.length > 4) {
        shown = shown.slice(0, -2);
      }
      ctx.fillText(shown, left + 78, y + cardHeight / 2 + 2);

      // Amount and status chips.
      const chipWidth = 96;
      const chipX = left + cardWidth - chipWidth - 18;
      rounded(ctx, chipX, y + cardHeight / 2 - 16, chipWidth, 32, 16);
      ctx.fillStyle = 'rgba(61,220,132,0.14)';
      ctx.fill();
      ctx.fillStyle = GREEN;
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`$${amount}`, chipX + chipWidth / 2, y + cardHeight / 2 + 1);
      ctx.textAlign = 'left';

      if (active) {
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.arc(left + cardWidth - 22, y + 22, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};
