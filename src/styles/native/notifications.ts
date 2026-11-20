import { clamp01, type LyricStyle } from '../types';

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

export const notifications: LyricStyle = {
  id: 'notifications',
  name: 'Native Design Notifications',
  description: 'Lines arrive as lock-screen notifications, stacks and widgets.',
  group: 'native',
  usesIcons: false,
  gradient: ['#14161a', '#4a4f5c'],
  palette: {
    accent: '#8fb4ff',
    text: '#f5f7fb',
    dim: 'rgba(245,247,251,0.42)',
    background: '#0a0b0d',
  },

  render(ctx, state) {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#101216');
    backdrop.addColorStop(0.65, '#0b0c0f');
    backdrop.addColorStop(1, '#060708');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const now = new Date();
    const clock = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const date = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(245,247,251,0.75)';
    ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(date, width / 2, height * 0.1);
    ctx.fillStyle = '#f5f7fb';
    ctx.font = '200 84px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
    ctx.fillText(clock, width / 2, height * 0.2);

    const index = state.activeIndex;
    const cardWidth = Math.min(width * 0.78, 760);
    const left = (width - cardWidth) / 2;
    const cardHeight = 78;
    const gap = 14;
    let y = height * 0.32;

    if (index < 0) {
      ctx.fillStyle = 'rgba(245,247,251,0.32)';
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(state.track.title ? 'No notifications yet' : 'Nothing playing', width / 2, height * 0.5);
      return;
    }

    const activeLine = state.lines[index];
    const previous = index > 0 ? state.lines[index - 1] : null;
    const older = Math.max(0, index - 1);

    // The newest line slides down from behind the clock.
    const arrival = activeLine ? clamp01((state.positionMs - activeLine.startMs) / 320) : 1;
    const slide = (1 - arrival) * -60;

    if (activeLine) {
      const words = activeLine.words.length > 0 ? activeLine.words : [];
      const typed = words.length > 0 && state.wordIndex >= 0
        ? words
            .slice(0, state.wordIndex + 1)
            .map((word, position) =>
              position === state.wordIndex
                ? word.text.slice(0, Math.max(1, Math.ceil(word.text.length * clamp01(state.wordProgress))))
                : word.text,
            )
            .join(' ')
        : activeLine.text;

      const cardY = y + slide;
      rounded(ctx, left, cardY, cardWidth, cardHeight, 20);
      ctx.fillStyle = 'rgba(32,35,41,0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const iconX = left + 34;
      const iconY = cardY + cardHeight / 2;
      const icon = ctx.createLinearGradient(iconX - 16, iconY - 16, iconX + 16, iconY + 16);
      icon.addColorStop(0, '#8fb4ff');
      icon.addColorStop(1, '#4d6bd8');
      ctx.fillStyle = icon;
      rounded(ctx, iconX - 16, iconY - 16, 32, 32, 9);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f5f7fb';
      ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(state.track.title || 'Lyrica', left + 64, cardY + 26);

      ctx.fillStyle = 'rgba(245,247,251,0.55)';
      ctx.font = '400 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('now', left + cardWidth - 20, cardY + 26);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(245,247,251,0.92)';
      ctx.font = '500 16px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
      ctx.fillText(typed || '…', left + 64, cardY + 52);
      y = cardY + cardHeight + gap;
    }

    // Older lines collapse into a quiet stack.
    if (previous) {
      rounded(ctx, left + 12, y, cardWidth - 24, cardHeight - 18, 18);
      ctx.fillStyle = 'rgba(26,29,34,0.8)';
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(245,247,251,0.5)';
      ctx.font = '400 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(previous.text, left + 28, y + 24);
      y += cardHeight - 18 + 10;
    }

    if (older > 1) {
      rounded(ctx, left + 24, y, cardWidth - 48, 34, 17);
      ctx.fillStyle = 'rgba(22,24,29,0.7)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(245,247,251,0.5)';
      ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`+${older - 1} more`, width / 2, y + 17);
    }

    // The widget row that sits under the lock-screen clock.
    const widgetY = height - 132;
    const widgetWidth = Math.min(width * 0.26, 240);
    const gapX = 14;
    const totalWidth = widgetWidth * 3 + gapX * 2;
    const startX = (width - totalWidth) / 2;
    const widgets = [
      { title: '18°', caption: 'Clear night' },
      { title: state.track.title ? state.track.title.slice(0, 14) : 'Nothing', caption: state.track.artist || 'playing' },
      { title: '82%', caption: 'Battery' },
    ];

    widgets.forEach((widget, position) => {
      const x = startX + position * (widgetWidth + gapX);
      rounded(ctx, x, widgetY, widgetWidth, 74, 18);
      ctx.fillStyle = 'rgba(24,27,32,0.9)';
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f5f7fb';
      ctx.font = '600 17px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
      ctx.fillText(widget.title, x + 16, widgetY + 28);
      ctx.fillStyle = 'rgba(245,247,251,0.45)';
      ctx.font = '400 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(widget.caption, x + 16, widgetY + 50);
    });
  },
};
