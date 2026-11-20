import { clamp01, type LyricStyle } from '../types';

export const web: LyricStyle = {
  id: 'web',
  name: 'Web',
  description: "Each line spun into a spider's web, a strand for every word.",
  group: 'scenes',
  usesIcons: false,
  gradient: ['#0b0b16', '#3c3f6b'],
  palette: {
    accent: '#c9d4ff',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.3)',
    background: '#05060c',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    const index = state.activeIndex;
    const cx = width / 2;
    const cy = height * 0.52;
    const radius = Math.min(width, height) * 0.34;

    // A ghost of the previous web, fading out.
    const previous = index > 0 ? state.lines[index - 1] : null;
    if (previous) {
      const strands = Math.min(14, Math.max(3, previous.words.length || 6));
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let strand = 0; strand < strands; strand += 1) {
        const angle = (strand / strands) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx - 80, cy);
        ctx.lineTo(cx - 80 + Math.cos(angle) * radius * 0.7, cy + Math.sin(angle) * radius * 0.7);
        ctx.stroke();
      }
    }

    if (index < 0) {
      ctx.fillStyle = palette.dim;
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? 'Spinning…' : 'Nothing playing', cx, cy);
      return;
    }

    const line = state.lines[index];
    const words = line.words.length > 0
      ? line.words
      : [{ text: line.text, startMs: line.startMs, endMs: line.endMs }];
    const strands = Math.min(14, Math.max(3, words.length));
    const activeStrand = Math.min(strands - 1, Math.max(0, state.wordIndex));

    // Radial anchors.
    const anchors = Array.from({ length: strands }, (_, strand) => {
      const angle = (strand / strands) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, angle };
    });

    // Spiral thread joining the strands, tightening towards the middle.
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring += 1) {
      const scale = ring / 5;
      ctx.beginPath();
      anchors.forEach((anchor, strand) => {
        const x = cx + Math.cos(anchor.angle) * radius * scale;
        const y = cy + Math.sin(anchor.angle) * radius * scale;
        if (strand === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }

    anchors.forEach((anchor, strand) => {
      const isActive = strand === activeStrand && state.wordIndex >= 0;
      const sung = strand < activeStrand;

      ctx.strokeStyle = isActive
        ? palette.accent
        : sung
          ? 'rgba(255,255,255,0.4)'
          : 'rgba(255,255,255,0.16)';
      ctx.lineWidth = isActive ? 2.6 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(anchor.x, anchor.y);
      ctx.stroke();

      // Dewdrop at the end of the strand carries the word.
      const dropRadius = isActive ? 8 : 4.5;
      ctx.fillStyle = isActive ? palette.accent : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, dropRadius, 0, Math.PI * 2);
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = 'rgba(201,212,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, dropRadius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(state.wordProgress));
        ctx.stroke();
      }

      const label = words[strand]?.text ?? '';
      if (!label) return;
      ctx.font = `${isActive ? 600 : 500} ${isActive ? 21 : 15}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = isActive ? palette.text : 'rgba(255,255,255,0.32)';
      ctx.textAlign = Math.cos(anchor.angle) > 0.25 ? 'left' : Math.cos(anchor.angle) < -0.25 ? 'right' : 'center';
      ctx.textBaseline = 'middle';
      const offset = dropRadius + 12;
      ctx.fillText(
        label,
        anchor.x + Math.cos(anchor.angle) * offset,
        anchor.y + Math.sin(anchor.angle) * offset,
      );
    });

    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  },
};
