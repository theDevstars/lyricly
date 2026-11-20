import { clamp01, type LyricStyle } from '../types';

/** Nodes for one line, marching left to right along a gentle curve. */
function nodesFor(
  text: string,
  count: number,
  width: number,
  height: number,
  branch: number,
): { x: number; y: number }[] {
  const nodes: { x: number; y: number }[] = [];
  const span = Math.min(width * 0.66, 900);
  const left = width / 2 - span / 2;
  const baseY = height * (0.42 + (branch % 4) * 0.09);

  for (let index = 0; index < Math.max(1, count); index += 1) {
    const t = count <= 1 ? 0.5 : index / (count - 1);
    nodes.push({
      x: left + span * t,
      y: baseY + Math.sin(t * Math.PI * 1.4 + text.length) * height * 0.06,
    });
  }
  return nodes;
}

export const branches: LyricStyle = {
  id: 'branches',
  name: 'Branches',
  description: 'A line draws itself, and each word lights a node on it.',
  group: 'scenes',
  usesIcons: false,
  gradient: ['#08130f', '#2f6f4f'],
  palette: {
    accent: '#7ef2b0',
    text: '#ffffff',
    dim: 'rgba(255,255,255,0.3)',
    background: '#050a08',
  },

  render(ctx, state) {
    const { width, height, palette } = state;
    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, '#050a08');
    backdrop.addColorStop(0.6, '#08120e');
    backdrop.addColorStop(1, '#030605');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const index = state.activeIndex;
    if (index < 0) {
      ctx.fillStyle = palette.dim;
      ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.track.title ? 'Waiting…' : 'Nothing playing', width / 2, height / 2);
      return;
    }

    // The last few lines stay on screen as older branches, each one a step
    // further away.
    const from = Math.max(0, index - 3);
    ctx.textBaseline = 'middle';

    for (let lineIndex = from; lineIndex <= index; lineIndex += 1) {
      const line = state.lines[lineIndex];
      if (!line) continue;

      const words = line.words.length > 0
        ? line.words
        : [{ text: line.text, startMs: line.startMs, endMs: line.endMs }];
      const nodes = nodesFor(line.text, words.length, width, height, lineIndex);
      const isActiveLine = lineIndex === index;
      const lit = isActiveLine ? Math.max(0, state.wordIndex) : words.length - 1;
      const growth = isActiveLine ? clamp01(state.wordProgress) : 1;

      ctx.lineWidth = isActiveLine ? 2.4 : 1.2;
      ctx.strokeStyle = isActiveLine ? 'rgba(126,242,176,0.75)' : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      nodes.forEach((node, position) => {
        if (position === 0) ctx.moveTo(node.x, node.y);
        else ctx.lineTo(node.x, node.y);
      });
      ctx.stroke();

      // A branch stub off the last node, so each new line reads as a fork.
      const last = nodes[nodes.length - 1];
      if (last) {
        ctx.strokeStyle = isActiveLine ? 'rgba(126,242,176,0.35)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x + 60, last.y - 40);
        ctx.stroke();
      }

      nodes.forEach((node, position) => {
        const active = isActiveLine && position === state.wordIndex;
        const sung = position < lit;
        const reachable = !isActiveLine || position <= lit;

        const radius = active ? 7 : 4;
        ctx.fillStyle = active
          ? palette.accent
          : sung || !isActiveLine
            ? 'rgba(255,255,255,0.62)'
            : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (active) {
          ctx.strokeStyle = 'rgba(126,242,176,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * growth);
          ctx.stroke();
        }

        if (reachable && (isActiveLine || position % 2 === 0)) {
          ctx.textAlign = 'center';
          ctx.font = `${active ? 600 : 500} ${active ? 22 : 15}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
          ctx.fillStyle = active ? palette.text : 'rgba(255,255,255,0.34)';
          ctx.fillText(words[position]?.text ?? '', node.x, node.y - 24);
        }
      });
    }
  },
};
