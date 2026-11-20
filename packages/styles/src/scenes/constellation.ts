import { clamp01, type LyricStyle } from '../types';

/** Deterministic pseudo-random so a line always draws the same stars. */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const constellation: LyricStyle = {
  id: 'constellation',
  name: 'Constellation',
  description: 'Each line traced as a constellation, star by star.',
  group: 'scenes',
  usesIcons: false,
  gradient: ['#070d1f', '#2b3f7a'],
  palette: {
    accent: '#9fc4ff',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.32)',
    background: '#04060f',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.1,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8,
    );
    backdrop.addColorStop(0, '#0a1226');
    backdrop.addColorStop(1, palette.background);
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const index = state.activeIndex;
    const line = index >= 0 ? state.lines[index] : null;

    if (!line) {
      ctx.fillStyle = palette.dim;
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.track.title ? 'Waiting for the next line…' : 'Nothing playing', width / 2, height / 2);
      return;
    }

    const words = line.words.length > 0
      ? line.words
      : [{ text: line.text, startMs: line.startMs, endMs: line.endMs }];

    const random = mulberry32(line.startMs + words.length * 31);
    const cx = width / 2;
    const cy = height * 0.48;
    const spreadX = width * 0.32;
    const spreadY = height * 0.24;

    const stars = words.map((word, position) => {
      const angle = (position / Math.max(1, words.length - 1 || 1)) * Math.PI * 0.9 - Math.PI * 0.45;
      const wobble = 0.55 + random() * 0.5;
      return {
        word,
        x: cx + Math.sin(angle) * spreadX * wobble + (random() - 0.5) * 40,
        y: cy + Math.sin(angle * 1.7 + random()) * spreadY,
      };
    });

    // Faint dust so the sky is not empty.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let dot = 0; dot < 40; dot += 1) {
      ctx.globalAlpha = 0.12 + random() * 0.2;
      ctx.fillRect(random() * width, random() * height, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;

    const lit = state.wordIndex >= 0 ? state.wordIndex : 0;

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(159,196,255,0.35)';
    ctx.beginPath();
    stars.forEach((star, position) => {
      if (position > lit) return;
      if (position === 0) ctx.moveTo(star.x, star.y);
      else ctx.lineTo(star.x, star.y);
    });
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '500 15px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

    stars.forEach((star, position) => {
      const active = position === state.wordIndex;
      const sung = position < lit;

      if (active) {
        const glow = ctx.createRadialGradient(star.x, star.y, 1, star.x, star.y, 34);
        glow.addColorStop(0, 'rgba(159,196,255,0.55)');
        glow.addColorStop(1, 'rgba(159,196,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 34, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = active ? palette.accent : sung ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(star.x, star.y, active ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (active) {
        ctx.strokeStyle = 'rgba(159,196,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(state.wordProgress));
        ctx.stroke();
      }

      ctx.fillStyle = active ? palette.text : 'rgba(255,255,255,0.42)';
      ctx.font = `${active ? 600 : 500} ${active ? 21 : 15}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(star.word.text, star.x, star.y + 16);
    });
  },
};
