import type { LyricLine, LyricStyle, StyleState } from '../../types';
import { fontOf } from '../../lib/text';
import {
  buildGraphs,
  graphAt,
  graphState,
  linkReveal,
  transitionAmount,
  type Graph,
} from './graphModel';
import {
  layoutConstellation,
  placeActiveLabel,
  seedFrom,
  type Box,
  type PlacedWord,
} from './constellationLayout';
import { constellationColors, type ConstellationColors, type ConstellationVariant } from './palette';

/**
 * Constellation — the lyric as a growing star graph. Nodes are four-point
 * stars, links draw themselves in singing order, and the word being sung swells
 * into a bright star with a halo while its neighbours settle into small labels.
 */

const FAMILY = '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

const GRAPH_CACHE = new WeakMap<LyricLine[], Graph[]>();
const LAYOUT_CACHE = new Map<string, PlacedWord[]>();
const ACTIVE_SLOT_CACHE = new Map<string, Box>();
const MEASURE_CACHE = new Map<string, number>();
const SPRITE_CACHE = new Map<string, HTMLCanvasElement>();

function graphsFor(lines: LyricLine[]): Graph[] {
  const cached = GRAPH_CACHE.get(lines);
  if (cached) return cached;
  const graphs = buildGraphs(lines);
  GRAPH_CACHE.set(lines, graphs);
  return graphs;
}

function measure(ctx: CanvasRenderingContext2D, text: string, size: number, weight: number): number {
  const key = `${size}|${weight}|${text}`;
  const cached = MEASURE_CACHE.get(key);
  if (cached !== undefined) return cached;
  ctx.font = fontOf(size, weight, FAMILY);
  const width = ctx.measureText(text).width;
  MEASURE_CACHE.set(key, width);
  return width;
}

/** Draws the star directly; used when there is no DOM to pre-render into. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  const inner = radius * 0.17;
  ctx.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const length = point % 2 === 0 ? radius : inner;
    const angle = -Math.PI / 2 + (point * Math.PI) / 4;
    const px = x + Math.cos(angle) * length;
    const py = y + Math.sin(angle) * length;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Four-point star, pre-rendered once per colour and drawn scaled. */
function starSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `star|${color}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const sprite = canvas.getContext('2d');
  if (sprite) {
    sprite.translate(size / 2, size / 2);
    sprite.beginPath();
    const outer = size / 2 - 3;
    const inner = outer * 0.17;
    for (let point = 0; point < 8; point += 1) {
      const radius = point % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (point * Math.PI) / 4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) sprite.moveTo(x, y);
      else sprite.lineTo(x, y);
    }
    sprite.closePath();
    sprite.fillStyle = color;
    sprite.fill();
  }
  SPRITE_CACHE.set(key, canvas);
  return canvas;
}

/** Soft round halo behind the active star. */
function haloSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `halo|${color}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const sprite = canvas.getContext('2d');
  if (sprite) {
    const paint = sprite.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    paint.addColorStop(0, color);
    paint.addColorStop(0.55, color);
    paint.addColorStop(1, 'rgba(0,0,0,0)');
    sprite.fillStyle = paint;
    sprite.fillRect(0, 0, size, size);
  }
  SPRITE_CACHE.set(key, canvas);
  return canvas;
}

interface Frame {
  graph: Graph;
  positionMs: number;
  alpha: number;
  offsetY: number;
  smear: number;
  current: boolean;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: StyleState,
  colors: ConstellationColors,
  frame: Frame,
  scale: number,
  reduced: boolean,
  photosensitive: boolean,
): void {
  const { graph, positionMs } = frame;
  const { width, height } = state;
  if (frame.alpha <= 0.01) return;

  const words = graphState(graph, positionMs);
  // Between words nothing is big, so nothing needs the big box reserved.
  const activeIndex = words.activeIndex;
  const labelSize = 13 * scale;
  const activeSize = 64 * scale;
  const secondarySize = activeSize * 0.55;
  const starSettled = 5.5 * scale;
  const starActive = 17 * scale;

  const margins = {
    left: Math.round(width * 0.06),
    right: Math.round(width * 0.06 + 40 * scale),
    top: Math.round(height * 0.09),
    bottom: Math.round(height * 0.14),
  };

  // One layout per phrase: the active word is not part of the key, so no label
  // moves while the song moves through the graph.
  const layoutKey = [
    graph.id,
    width,
    height,
    Math.round(scale * 10),
    state.styleOptions?.['constellation.palette'] ?? 'warm',
  ].join('|');

  let layout = LAYOUT_CACHE.get(layoutKey);
  if (!layout) {
    const labels = graph.words.map((word) => ({
      key: word.key,
      width: measure(ctx, word.text, labelSize, 600) + 4,
      height: labelSize * 1.5,
    }));

    layout = layoutConstellation({
      width,
      height,
      seed: seedFrom(graph.id, 'constellation'),
      labels,
      margins,
    });
    LAYOUT_CACHE.set(layoutKey, layout);
    if (LAYOUT_CACHE.size > 24) {
      const oldest = LAYOUT_CACHE.keys().next().value;
      if (oldest) LAYOUT_CACHE.delete(oldest);
    }
  }

  // The large word is placed into a free gap near its star; the labels stay put.
  let activeSlot: Box | null = null;
  if (activeIndex >= 0 && layout[activeIndex]) {
    const slotKey = `${layoutKey}|slot|${activeIndex}`;
    activeSlot = ACTIVE_SLOT_CACHE.get(slotKey) ?? null;
    if (!activeSlot) {
      const word = graph.words[activeIndex];
      activeSlot = placeActiveLabel(
        { x: layout[activeIndex].x, y: layout[activeIndex].y },
        { width: measure(ctx, word.text, activeSize, 900) + 8, height: activeSize * 1.25 },
        layout.map((node) => node.label),
        { width, height, margins },
      );
      ACTIVE_SLOT_CACHE.set(slotKey, activeSlot);
      if (ACTIVE_SLOT_CACHE.size > 48) {
        const oldest = ACTIVE_SLOT_CACHE.keys().next().value;
        if (oldest) ACTIVE_SLOT_CACHE.delete(oldest);
      }
    }
  }

  // Slow ambient drift, well under 4px a second.
  const driftX = reduced ? 0 : Math.sin(state.time * 0.00016) * 3 * scale;
  const driftY = reduced ? 0 : Math.cos(state.time * 0.00012) * 2 * scale;

  ctx.save();
  ctx.globalAlpha = frame.alpha;
  ctx.translate(driftX, frame.offsetY + driftY);
  if (frame.smear > 0.02) ctx.filter = `blur(${Math.min(3, frame.smear * 2.5) * scale}px)`;

  const node = (index: number): PlacedWord | null => layout[index] ?? null;

  // Links: one per sung word, drawn in singing order with a dash reveal.
  ctx.lineWidth = Math.max(0.75, 1 * scale);
  ctx.strokeStyle = colors.line;
  for (let index = 1; index < graph.words.length; index += 1) {
    const progress = linkReveal(graph, index, positionMs);
    if (progress <= 0) continue;
    const from = node(index - 1);
    const to = node(index);
    if (!from || !to) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length < 1) continue;
    ctx.globalAlpha = frame.alpha * (progress < 1 ? 0.75 : 0.45);
    ctx.setLineDash(progress < 1 ? [length * progress, length] : []);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = frame.alpha;

  // Stars and labels.
  graph.words.forEach((word, index) => {
    const view = words.words[index];
    const place = node(index);
    if (!view || !place || view.phase === 'hidden') return;

    const active = view.phase === 'active';
    const ghost = view.phase === 'ghost';
    const twinkle = photosensitive ? 1 : 0.9 + 0.1 * Math.sin(state.time * 0.0011 + index * 1.7);
    const radius = active ? starActive : ghost ? 3 * scale : starSettled;

    if (active) {
      const haloSize = radius * 5.4;
      ctx.globalAlpha = frame.alpha * 0.9;
      const halo = haloSprite(colors.halo);
      if (halo) {
        ctx.drawImage(halo, place.x - haloSize / 2, place.y - haloSize / 2, haloSize, haloSize);
      } else {
        const paint = ctx.createRadialGradient(place.x, place.y, 1, place.x, place.y, haloSize / 2);
        paint.addColorStop(0, colors.halo);
        paint.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = paint;
        ctx.fillRect(place.x - haloSize / 2, place.y - haloSize / 2, haloSize, haloSize);
      }
      ctx.globalAlpha = frame.alpha * 0.22;
      ctx.strokeStyle = colors.halo;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(place.x, place.y, haloSize * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = frame.alpha;
    }

    ctx.globalAlpha = frame.alpha * (ghost ? 0.35 : active ? 1 : 0.75) * twinkle;
    const sprite = starSprite(active ? colors.bright : colors.text);
    const drawSize = radius * 2.6;
    if (sprite) {
      ctx.drawImage(sprite, place.x - drawSize / 2, place.y - drawSize / 2, drawSize, drawSize);
    } else {
      drawStar(ctx, place.x, place.y, drawSize / 2, active ? colors.bright : colors.text);
    }

    // Label under its star. The active word is the big one; it never leaves the
    // screen, so its box is clamped inward while the star stays on the node.
    ctx.globalAlpha = frame.alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (active && activeSlot) {
      ctx.font = fontOf(activeSize, 900, FAMILY);
      ctx.fillStyle = colors.bright;
      ctx.fillText(word.text, activeSlot.x + activeSlot.w / 2, activeSlot.y + activeSlot.h / 2);
    } else {
      ctx.font = fontOf(labelSize, 600, FAMILY);
      ctx.fillStyle = colors.label;
      ctx.fillText(word.text, place.label.x + place.label.w / 2, place.label.y + place.label.h / 2);
    }
  });

  // The previous word hangs a notch below the active one before it shrinks.
  const secondaryIndex = words.secondaryIndex;
  if (secondaryIndex >= 0 && secondaryIndex !== words.activeIndex) {
    const place = node(secondaryIndex);
    const view = words.words[secondaryIndex];
    if (place && view) {
      const anchorX = activeSlot ? activeSlot.x + activeSlot.w / 2 : place.x;
      const anchorY = activeSlot
        ? activeSlot.y + activeSlot.h + secondarySize * 0.85
        : place.label.y + place.label.h + secondarySize * 0.85;
      ctx.font = fontOf(secondarySize, 700, FAMILY);
      ctx.fillStyle = colors.label;
      ctx.globalAlpha = frame.alpha * 0.85;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(view.text, anchorX, Math.min(anchorY, height - margins.bottom - secondarySize * 0.6));
    }
  }

  ctx.restore();
}

export const constellation: LyricStyle = {
  id: 'constellation',
  name: 'Constellation',
  description: 'Each phrase traced as a constellation, star by star.',
  group: 'scenes',
  eyebrow: 'Motion scenes',
  sample: 'Stars',
  usesIcons: false,
  gradient: ['#0a0703', '#8a6a2a'],
  palette: {
    accent: '#E2B24A',
    text: '#F3E7C4',
    dim: 'rgba(243,231,196,0.55)',
    background: '#050403',
  },

  render(ctx, state) {
    const { width, height } = state;
    const variant: ConstellationVariant =
      state.styleOptions?.['constellation.palette'] === 'cool' ? 'cool' : 'warm';
    const colors = constellationColors(state.palette, variant);
    const reduced = Boolean(state.reduceMotion);
    const photosensitive = Boolean(state.photosensitive);
    // Scale from the shorter side, with a floor so 720p still gets an 11px
    // label rather than an unreadable 8px one.
    const scale = Math.min(2.6, Math.max(0.85, Math.min(width, height) / 1080));

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Faint dust, so the sky is not empty.
    for (let dot = 0; dot < 46; dot += 1) {
      const x = ((dot * 137.508) % 1) * width;
      const y = ((dot * 61.803) % 1) * height;
      const shimmer = reduced ? 0.12 : 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(state.time * 0.0009 + dot));
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = colors.text;
      ctx.fillRect(x, y, 1.3 * scale, 1.3 * scale);
    }
    ctx.globalAlpha = 1;

    const graphs = graphsFor(state.lines);
    const view = graphs.length > 0 ? graphAt(graphs, state.positionMs) : null;

    if (!view) {
      ctx.fillStyle = colors.label;
      ctx.font = fontOf(20 * scale, 500, FAMILY);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.track.title ? 'Waiting for the next line…' : 'Nothing playing', width / 2, height / 2);
      return;
    }

    if (view.previous && view.previousFade < 1) {
      drawFrame(
        ctx,
        state,
        colors,
        {
          graph: view.previous,
          // Just past its last word: the old graph leaves as settled labels, not
          // with a second big word competing with the new one.
          positionMs: view.previous.endMs + 1,
          alpha: 1 - view.previousFade,
          offsetY: reduced ? 0 : -10 * scale * view.previousFade,
          smear: reduced ? 0 : view.previousFade,
          current: false,
        },
        scale,
        reduced,
        photosensitive,
      );
    }

    const smear = transitionAmount(view.graph, state.positionMs, reduced);

    if (smear > 0.02) {
      // Motion smear while the new graph lands: one blurred pass behind it.
      drawFrame(
        ctx,
        state,
        colors,
        {
          graph: view.graph,
          positionMs: state.positionMs,
          alpha: 0.45 * smear,
          offsetY: -4 * scale * smear,
          smear,
          current: true,
        },
        scale,
        reduced,
        photosensitive,
      );
    }

    drawFrame(
      ctx,
      state,
      colors,
      {
        graph: view.graph,
        positionMs: state.positionMs,
        alpha: 1,
        offsetY: 0,
        smear: 0,
        current: true,
      },
      scale,
      reduced,
      photosensitive,
    );
  },
};

