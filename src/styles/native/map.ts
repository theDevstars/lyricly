import { clamp01, type LyricStyle } from '../types';

const ACCENT = '#ffb347';

function seedFor(text: string, salt: number): number {
  let hash = salt >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
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

export const map: LyricStyle = {
  id: 'map',
  name: 'Native Design Map',
  description: 'A walk across a city, with a pin for every line.',
  group: 'native',
  usesIcons: false,
  gradient: ['#0d1217', '#3f4a55'],
  palette: {
    accent: ACCENT,
    text: '#f4f7fa',
    dim: 'rgba(244,247,250,0.4)',
    background: '#080b0e',
  },

  render(ctx, state) {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(0, 0, width, height);

    // City blocks: a seeded grid so the map is stable between frames.
    const blockWidth = 92;
    const blockHeight = 74;
    for (let row = 0; row < Math.ceil(height / blockHeight); row += 1) {
      for (let column = 0; column < Math.ceil(width / blockWidth); column += 1) {
        const seed = seedFor(`${row}:${column}`, 3);
        if (seed % 7 === 0) continue;
        const inset = 6;
        rounded(
          ctx,
          column * blockWidth + inset,
          row * blockHeight + inset,
          blockWidth - inset * 2,
          blockHeight - inset * 2,
          6,
        );
        ctx.fillStyle = seed % 3 === 0 ? 'rgba(31,42,52,0.9)' : 'rgba(22,30,38,0.9)';
        ctx.fill();
      }
    }

    const index = state.activeIndex;
    if (index < 0) {
      ctx.fillStyle = 'rgba(244,247,250,0.32)';
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? 'Finding the route…' : 'Nothing playing', width / 2, height / 2);
      return;
    }

    // The walk: one leg per line, drifting with the song.
    const from = Math.max(0, index - 3);
    const legs: { x: number; y: number; line: string }[] = [];
    for (let lineIndex = from; lineIndex <= index; lineIndex += 1) {
      const line = state.lines[lineIndex];
      if (!line) continue;
      const seed = seedFor(line.text, lineIndex + 11);
      legs.push({
        x: width * 0.22 + ((seed % 56) / 100) * width * 0.56,
        y: height * 0.3 + ((seed % 41) / 100) * height * 0.42,
        line: line.text,
      });
    }

    if (legs.length === 0) return;

    ctx.strokeStyle = 'rgba(255,179,71,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    legs.forEach((leg, position) => {
      if (position === 0) ctx.moveTo(leg.x, leg.y);
      else ctx.lineTo(leg.x, leg.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    legs.forEach((leg, position) => {
      const active = position === legs.length - 1;
      const pinX = leg.x;
      const pinY = leg.y;

      ctx.fillStyle = active ? ACCENT : 'rgba(255,179,71,0.35)';
      ctx.beginPath();
      ctx.arc(pinX, pinY, active ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();

      if (active) {
        ctx.strokeStyle = 'rgba(255,179,71,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pinX, pinY, 16, 0, Math.PI * 2 * clamp01(1));
        ctx.stroke();

        const words = state.lines[index]?.words ?? [];
        const typed = words.length > 0 && state.wordIndex >= 0
          ? words.slice(0, state.wordIndex + 1).map((word) => word.text).join(' ')
          : leg.line;

        ctx.font = '600 17px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
        const labelWidth = ctx.measureText(typed || leg.line).width + 28;
        const boxX = Math.min(width - labelWidth - 16, Math.max(16, pinX - labelWidth / 2));
        const boxY = pinY - 62;

        rounded(ctx, boxX, boxY, labelWidth, 38, 12);
        ctx.fillStyle = 'rgba(12,17,22,0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,179,71,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#f4f7fa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typed, boxX + labelWidth / 2, boxY + 20);

        ctx.fillStyle = 'rgba(255,179,71,0.9)';
        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('now walking', pinX, pinY + 24);
      }
    });

    // A small compass, so it reads as a map rather than a diagram.
    const compassX = width - 60;
    const compassY = 60;
    ctx.strokeStyle = 'rgba(244,247,250,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(compassX, compassY, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(compassX, compassY - 14);
    ctx.lineTo(compassX + 6, compassY + 6);
    ctx.lineTo(compassX - 6, compassY + 6);
    ctx.closePath();
    ctx.fill();
  },
};
