import type { LyricStyle } from '../../types';
import { backdrop, layoutActive, paintRows } from '../../lib/draw';
import { fontOf } from '../../lib/text';
import { energyOf } from '../../lib/energy';
import { bounce, stretch, waveAt } from './model';

/**
 * Waveform Words — the line rides a live-looking waveform that swells with the
 * section's energy, and the wave passes under the word being sung.
 */
export const waveformWords: LyricStyle = {
  id: 'waveform-words',
  name: 'Waveform Words',
  description: 'Lyrics ride a live waveform that moves with the bass.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Wave',
  isNew: true,
  defaultEffects: ['reactive'],
  usesIcons: false,
  gradient: ['#01120f', '#25e6a8'],
  palette: {
    accent: '#25e6a8',
    text: '#eafff7',
    dim: 'rgba(234,255,247,0.32)',
    background: '#04120e',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    backdrop(ctx, width, height, '#04120e', '#062a20');
    const energy = energyOf(state);
    const audio = state.audio;
    const live = Boolean(audio?.active) && (audio?.bands.length ?? 0) > 3;

    // The waveform: the real spectrum when audio is playing, otherwise a motion
    // shaped by the lyric energy so the style never goes dead quiet.
    const sampleAt = (x: number): number => {
      if (!live) return waveAt(x, state.time, energy.level, width);
      const bands = audio!.bands;
      const position = (x / Math.max(1, width)) * (bands.length - 1);
      const low = Math.floor(position);
      const fraction = position - low;
      const a = bands[low] ?? 0;
      const b = bands[Math.min(bands.length - 1, low + 1)] ?? a;
      return (a + (b - a) * fraction) * 2 - 1;
    };

    const baseline = height * 0.72;
    const amplitude = height * (live ? 0.13 + audio!.bass * 0.14 : 0.16);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 6) {
      const y = baseline + sampleAt(x) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(1.5, height * 0.0035);
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, baseline - amplitude, 0, height);
    fill.addColorStop(0, 'rgba(37,230,168,0.22)');
    fill.addColorStop(1, 'rgba(37,230,168,0)');
    ctx.fillStyle = fill;
    ctx.fill();

    const layout = layoutActive(ctx, state, { maxRows: 2, weight: 700 });
    if (!layout) {
      ctx.fillStyle = palette.dim;
      ctx.font = fontOf(Math.min(22, width / 34), 500);
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? '♪' : 'Play a track to see lyrics', width / 2, height * 0.4);
      return;
    }

    ctx.textBaseline = 'middle';

    paintRows(state, layout, { centerY: false, top: height * 0.3, lineHeight: layout.size * 1.25 }, ({ x, y, row }) => {
      let cursor = x;
      for (const item of row) {
        const active = item.wordIndex === state.wordIndex;
        const offset = active ? 0 : bounce(item.wordIndex, energy.level, energy.pulse);
        ctx.save();
        ctx.translate(cursor + item.width / 2, y + offset);
        ctx.scale(stretch(active ? 1 : energy.level, energy.pulse), 2 - stretch(energy.level, energy.pulse));
        ctx.font = fontOf(layout.size, active ? 800 : 600);
        ctx.textAlign = 'center';
        ctx.fillStyle = active ? palette.accent : palette.text;
        if (active) {
          ctx.shadowColor = palette.accent;
          ctx.shadowBlur = 16;
        }
        ctx.fillText(item.text, 0, 0);
        ctx.restore();
        cursor += item.width + layout.size * 0.28;
      }
    });
  },
};
