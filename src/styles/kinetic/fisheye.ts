import { iconFor } from '../icons';
import { clamp01, type LyricStyle } from '../types';

/**
 * Fisheye — a tight vertical stack of three words bulging through a lens.
 * With `withIcons` the words that have a picture get one beside them, which is
 * what the Fisheye Visual variant uses.
 */
export function makeFisheye(withIcons: boolean): LyricStyle {
  return {
    id: withIcons ? 'fisheye-visual' : 'fisheye',
    name: withIcons ? 'Fisheye Visual' : 'Fisheye',
    description: withIcons
      ? 'Fisheye, with icons beside the words that have one.'
      : 'A tight stack of three words, bulging through a lens.',
    group: 'kinetic',
    usesIcons: withIcons,
    gradient: withIcons ? ['#241b3a', '#6d3b8f'] : ['#151a2e', '#3d5a80'],
    palette: {
      accent: '#ffd479',
      text: '#ffffff',
      dim: 'rgba(255,255,255,0.35)',
      background: '#07070c',
    },

    render(ctx, state) {
      const { width, height, palette } = state;
      ctx.clearRect(0, 0, width, height);

      const backdrop = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
      backdrop.addColorStop(0, withIcons ? '#241b3a' : '#151a2e');
      backdrop.addColorStop(1, '#05050a');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);

      const line = state.activeIndex >= 0 ? state.lines[state.activeIndex] : null;
      const cx = width / 2;
      const cy = height / 2;

      // Lens ring.
      const radius = Math.min(width * 0.34, height * 0.62);
      const lens = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
      lens.addColorStop(0, 'rgba(255,255,255,0.05)');
      lens.addColorStop(0.75, 'rgba(255,255,255,0.02)');
      lens.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      if (!line) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(state.track.title ? 'Waiting for the next line…' : 'Nothing playing', cx, cy);
        return;
      }

      const words = line.words.length > 0 ? line.words.map((word) => word.text) : line.text.split(/\s+/);
      const activeWord = Math.max(0, Math.min(words.length - 1, state.wordIndex));
      const start = Math.max(0, Math.min(activeWord - 1, words.length - 3));
      const stack = words.slice(start, start + 3);

      const fontSize = Math.min(64, Math.max(30, width / 11));
      const spacing = fontSize * 1.16;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      stack.forEach((text, offset) => {
        const wordIndex = start + offset;
        const distance = Math.abs(wordIndex - activeWord);
        const isActive = wordIndex === activeWord;
        const bulge = Math.max(0, 1 - distance * 0.42);
        const y = cy + (offset - 1) * spacing;
        const scaleY = 1 + bulge * 0.22;
        const scaleX = 1 + bulge * 0.3;
        const alpha = isActive ? 1 : 0.28 + bulge * 0.15;

        const icon = withIcons ? iconFor(text) : null;

        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(scaleX, scaleY);
        ctx.globalAlpha = alpha;
        ctx.font = `${isActive ? 700 : 500} ${fontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;

        if (isActive) {
          ctx.shadowColor = 'rgba(255, 212, 121, 0.55)';
          ctx.shadowBlur = 30;
          ctx.fillStyle = palette.accent;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
        }

        if (icon) {
          ctx.font = `${fontSize * 0.86}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
          const iconWidth = ctx.measureText(icon).width;
          ctx.textAlign = 'right';
          ctx.fillText(icon, -12, 0);
          ctx.textAlign = 'center';
          ctx.font = `${isActive ? 700 : 500} ${fontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
          ctx.fillText(text, iconWidth * 0.32, 0);
        } else {
          ctx.fillText(text, 0, 0);
        }
        ctx.restore();
      });

      // Word progress bar through the lens.
      const barWidth = radius * 1.1;
      const barY = cy + spacing * 1.55;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(cx - barWidth / 2, barY, barWidth, 2);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(cx - barWidth / 2, barY, barWidth * clamp01(state.lineProgress), 2);
      ctx.globalAlpha = 1;
    },
  };
}

export const fisheye = makeFisheye(false);
export const fisheyeVisual = makeFisheye(true);
