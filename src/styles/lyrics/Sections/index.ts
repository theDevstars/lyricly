import type { LyricStyle } from '../../types';
import { placeholder, rrect } from '../../lib/draw';
import { activeLine, fontOf } from '../../lib/text';
import { currentSection } from './model';

/**
 * Sections — lyrics grouped by verse, chorus and bridge, with a tag for the
 * section, a colour change per section and repeated chorus lines collapsed.
 */
export const sectionsStyle: LyricStyle = {
  id: 'sections',
  name: 'Sections',
  description: 'Lyrics grouped by verse, chorus and bridge.',
  group: 'lyrics',
  eyebrow: 'More lyrics',
  sample: '[Chorus]',
  isNew: true,
  usesIcons: false,
  gradient: ['#0d0a14', '#f0a8ff'],
  palette: {
    accent: '#f0a8ff',
    text: '#f7f0ff',
    dim: 'rgba(247,240,255,0.3)',
    background: '#0d0a14',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(0, 0, width, height);

    if (!activeLine(state.lines, state.activeIndex)) {
      placeholder(ctx, state);
      return;
    }

    const view = currentSection(state.lines, state.activeIndex);
    if (!view) {
      placeholder(ctx, state);
      return;
    }

    const size = Math.min(height * 0.052, width / 22);
    const pad = size * 1.6;
    const accent = view.chorus ? palette.accent : '#9fd8ff';

    // Section tag.
    ctx.font = fontOf(size * 0.8, 700);
    const label = view.label.toUpperCase();
    const tagWidth = ctx.measureText(label).width + pad;
    ctx.fillStyle = accent;
    rrect(ctx, pad, pad, tagWidth, size * 1.6, size * 0.8);
    ctx.fill();
    ctx.fillStyle = '#0d0a14';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pad + pad / 2, pad + size * 0.8);

    // Lines of this section, the sung one lit.
    const lineHeight = size * 1.75;
    let y = pad * 3.4 + size;
    const activeIndex = state.activeIndex;

    view.lines.forEach((row, index) => {
      const isActive = row.text === state.lines[activeIndex]?.text;
      ctx.font = fontOf(size * (isActive ? 1.12 : 1), isActive ? 700 : 500);
      ctx.fillStyle = isActive ? (view.chorus ? accent : palette.text) : palette.dim;
      let text = row.text;
      while (text.length > 4 && ctx.measureText(text).width > width - pad * 2 - size * 3) {
        text = `${text.slice(0, -2)}…`;
      }
      ctx.fillText(text, pad, y + index * lineHeight);
      if (row.mark) {
        ctx.font = fontOf(size * 0.8, 600);
        ctx.fillStyle = accent;
        ctx.fillText(row.mark, width - pad - size, y + index * lineHeight);
      }
    });
  },
};
