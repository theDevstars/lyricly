import { clamp01, easeOutCubic, flattenWords, type LyricStyle } from '../types';

const FOCAL = 780;
const DEPTH_STEP = 150;

/**
 * Shrinks a word that would be wider than its grid cell, so long words never
 * run into the next column. Measuring is injected for tests.
 */
export function fitFont(
  measure: (text: string) => number,
  text: string,
  fontPx: number,
  limit: number,
  floor = 10,
): number {
  const width = measure(text);
  if (width <= limit || width <= 0 || !Number.isFinite(width)) return fontPx;
  return Math.max(floor, fontPx * (limit / width));
}

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
    // The wall scales with the stage: five columns that always have room.
    const colSpacing = Math.min(320, Math.max(170, width / 5.2));
    const rowSpacing = Math.min(height * 0.105, colSpacing * 0.3);
    const columnWidth = colSpacing * 0.82;
    const baseFont = Math.max(12, rowSpacing * 0.62);
    const camX = Math.sin(time / 7000) * 90;
    const camY = Math.cos(time / 9000) * 30;

    // The wall itself: a perspective grid that slowly slides toward the viewer.
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let line = -6; line <= 6; line += 1) {
      const x = cx + camX + line * colSpacing;
      ctx.beginPath();
      ctx.moveTo(x, cy + camY - height);
      ctx.lineTo(cx + (x - cx) * 0.25, cy + camY + height);
      ctx.stroke();
    }
    for (let row = 0; row < 9; row += 1) {
      const depth = row * DEPTH_STEP + 120;
      const y = cy + camY + (row - 2) * rowSpacing * (FOCAL / (FOCAL + depth));
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

      // One word per grid cell. Using the line index here stacked every word in
      // a line into the same cell, which is what made long demo lines overlap.
      const column = index % 5;
      const row = Math.floor(index / 5) % 7;

      // Landing animation: fresh words drop in from further back.
      const since = state.positionMs - word.startMs;
      const landing = clamp01(since / 420);
      const drop = (1 - easeOutCubic(landing)) * 420;
      const effectiveDepth = depth + drop;

      const isActive = word.startMs <= state.positionMs && state.positionMs < word.endMs;
      const sung = word.endMs <= state.positionMs;

      const localX = (column - 2) * colSpacing + (row % 2 === 0 ? -1 : 1) * colSpacing * 0.05;
      const localY = (row - 3) * rowSpacing;
      const projectedScale = FOCAL / (FOCAL + effectiveDepth);
      const x = cx + camX * projectedScale + localX * projectedScale;
      const y = cy + camY * projectedScale + localY * projectedScale;

      const alpha = (isActive ? 1 : sung ? 0.85 : 0.4) * clamp01(effectiveDepth < 1200 ? 1 : 1.4 - effectiveDepth / 2400);
      if (alpha <= 0.01) continue;

      // Measure at the base size, then shrink this word to fit its cell.
      const weight = isActive ? 700 : 500;
      ctx.font = `${weight} ${baseFont}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
      const fontPx = fitFont(
        (text) => ctx.measureText(text).width,
        word.text,
        baseFont,
        columnWidth,
      );

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(projectedScale, projectedScale);
      ctx.font = `${weight} ${fontPx}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;

      if (isActive) {
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 20;
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
