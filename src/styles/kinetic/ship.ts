import { clamp01, easeOutCubic, flattenWords, type LyricStyle } from '../types';

const FOCAL = 780;
const COL_SPACING = 250;
const ROW_SPACING = 58;
const DEPTH_STEP = 150;

/**
 * Ship — words land one by one onto a wall that drifts through 3D. Newest words
 * sit closest to the camera and older ones recede into the grid.
 */
export const ship: LyricStyle = {
  id: 'ship',
  name: 'Ship',
  description: 'Words land one by one on a wall that drifts in 3D.',
  group: 'kinetic',
  usesIcons: false,
  gradient: ['#0b1d26', '#2c5364'],
  palette: {
    accent: '#9be7ff',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.32)',
    background: '#050a10',
  },

  render(ctx, state) {
    const { width, height, palette, time } = state;
    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#050a10');
    backdrop.addColorStop(0.55, '#081521');
    backdrop.addColorStop(1, '#03070c');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const camX = Math.sin(time / 7000) * 90;
    const camY = Math.cos(time / 9000) * 30;

    // The wall itself: a perspective grid that slowly slides toward the viewer.
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let line = -6; line <= 6; line += 1) {
      const x = cx + camX + line * COL_SPACING;
      ctx.beginPath();
      ctx.moveTo(x, cy + camY - height);
      ctx.lineTo(cx + (x - cx) * 0.25, cy + camY + height);
      ctx.stroke();
    }
    for (let row = 0; row < 9; row += 1) {
      const depth = row * DEPTH_STEP + 120;
      const y = cy + camY + (row - 2) * ROW_SPACING * (FOCAL / (FOCAL + depth));
      ctx.globalAlpha = 0.5 - row * 0.045;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const words = flattenWords(state.lines).slice(-28);
    if (words.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? 'Listening for lyrics…' : 'Play something on Spotify or Apple Music', cx, cy);
      return;
    }

    const newestFirst = words.length - 1;

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const age = newestFirst - index; // 0 = newest
      const depth = age * DEPTH_STEP + 110;
      const scale = FOCAL / (FOCAL + depth);
      if (scale <= 0.05) continue;

      const column = word.lineIndex % 5;
      const row = Math.floor(index / 5) % 7;

      // Landing animation: fresh words drop in from further back.
      const since = state.positionMs - word.startMs;
      const landing = clamp01(since / 420);
      const drop = (1 - easeOutCubic(landing)) * 420;
      const effectiveDepth = depth + drop;

      const isActive = word.startMs <= state.positionMs && state.positionMs < word.endMs;
      const sung = word.endMs <= state.positionMs;

      const localX = (column - 2) * COL_SPACING + (row % 2 === 0 ? -40 : 40);
      const localY = (row - 3) * ROW_SPACING;
      const projectedScale = FOCAL / (FOCAL + effectiveDepth);
      const x = cx + camX * projectedScale + localX * projectedScale;
      const y = cy + camY * projectedScale + localY * projectedScale;

      const alpha = (isActive ? 1 : sung ? 0.85 : 0.4) * clamp01(effectiveDepth < 1200 ? 1 : 1.4 - effectiveDepth / 2400);
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(projectedScale, projectedScale);
      ctx.font = `${isActive ? 700 : 500} 34px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;

      if (isActive) {
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 26;
        ctx.fillStyle = palette.accent;
      } else if (sung) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
      }

      ctx.fillText(word.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  },
};
