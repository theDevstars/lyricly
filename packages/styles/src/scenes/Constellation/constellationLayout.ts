/**
 * Seeded placement for a constellation graph. Pure: text is measured by the
 * caller, so the same seed and the same measurements always give the same
 * graph, and tests can drive it without a canvas.
 *
 * A phrase is laid out once. Which word is being sung never moves a label: the
 * big active word is placed into a free gap near its star at draw time with
 * `placeActiveLabel`, so the graph stays still while the song moves through it.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LabelMeasure {
  key: string;
  width: number;
  height: number;
}

export interface LayoutInput {
  width: number;
  height: number;
  seed: number;
  /** Label boxes in singing order. */
  labels: LabelMeasure[];
  margins: Margins;
}

export interface PlacedWord {
  key: string;
  /** The star itself. */
  x: number;
  y: number;
  /** The label box, pushed clear of its neighbours; the star never moves. */
  label: Box;
}

export interface Bounds {
  width: number;
  height: number;
  margins: Margins;
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from a graph id and anything else (a monitor, a mode). */
export function seedFrom(...parts: (string | number)[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0x1f;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const overlapArea = (a: Box, b: Box, pad: number): number => {
  const dx = Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x - pad, b.x - pad);
  const dy = Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y - pad, b.y - pad);
  return dx > 0 && dy > 0 ? dx * dy : 0;
};

function clampBox(box: Box, left: number, top: number, right: number, bottom: number): Box {
  const x = Math.min(Math.max(box.x, left), Math.max(left, right - box.w));
  const y = Math.min(Math.max(box.y, top), Math.max(top, bottom - box.h));
  return { ...box, x, y };
}

/** Candidate boxes around a preferred spot: under, above, then rings outward. */
function candidatesFor(base: Box): Box[] {
  const step = Math.max(8, base.h * 0.9);
  const list: Box[] = [{ ...base }];
  for (let ring = 1; ring <= 6; ring += 1) {
    const dy = step * ring;
    const dx = Math.min(base.w, step * ring * 1.4);
    list.push({ ...base, y: base.y + dy });
    list.push({ ...base, y: base.y - dy });
    list.push({ ...base, x: base.x + dx, y: base.y + dy });
    list.push({ ...base, x: base.x - dx, y: base.y + dy });
    list.push({ ...base, x: base.x + dx });
    list.push({ ...base, x: base.x - dx });
  }
  return list;
}

/**
 * The first candidate that clears every obstacle, else the one with the least
 * overlap. Used for labels and for the big active word.
 */
export function placeWithoutOverlap(
  base: Box,
  obstacles: Box[],
  bounds: Bounds,
  gap = 6,
): Box {
  const left = bounds.margins.left;
  const top = bounds.margins.top;
  const right = bounds.width - bounds.margins.right;
  const bottom = bounds.height - bounds.margins.bottom;

  let best: Box | null = null;
  let bestOverlap = Number.POSITIVE_INFINITY;
  for (const raw of candidatesFor(base)) {
    const candidate = clampBox(raw, left, top, right, bottom);
    const overlap = obstacles.reduce((sum, other) => sum + overlapArea(candidate, other, gap), 0);
    if (overlap === 0) return candidate;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      best = candidate;
    }
  }
  return best ?? clampBox(base, left, top, right, bottom);
}

/** Where the large active word goes: a free gap near its star, on screen. */
export function placeActiveLabel(
  star: { x: number; y: number },
  size: { width: number; height: number },
  obstacles: Box[],
  bounds: Bounds,
  gap = 6,
): Box {
  const below: Box = {
    x: star.x - size.width / 2,
    y: star.y + 18,
    w: size.width,
    h: size.height,
  };
  return placeWithoutOverlap(below, obstacles, bounds, gap);
}

/**
 * Scattered nodes with collision-free labels. Nodes sit in the middle band of
 * the safe area on a shuffled, jittered grid, so consecutive words cross the
 * graph and a half-built graph already looks scattered.
 */
export function layoutConstellation(input: LayoutInput): PlacedWord[] {
  const { width, height, labels, margins } = input;
  if (labels.length === 0) return [];

  const safe = {
    left: margins.left,
    top: margins.top,
    right: width - margins.right,
    bottom: height - margins.bottom,
  };
  // Middle 66% across, 62% down: the graph never hugs the edges.
  const band = {
    left: safe.left + (safe.right - safe.left) * 0.17,
    right: safe.right - (safe.right - safe.left) * 0.17,
    top: safe.top + (safe.bottom - safe.top) * 0.16,
    bottom: safe.bottom - (safe.bottom - safe.top) * 0.22,
  };

  const random = mulberry32(input.seed);
  const count = labels.length;
  const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.7)));
  const rows = Math.max(2, Math.ceil(count / cols));
  const cellW = (band.right - band.left) / cols;
  const cellH = (band.bottom - band.top) / rows;

  // Shuffle the cells so consecutive words land all over the graph instead of
  // marching along a row. This is also what gives the links their long
  // diagonals, and it is why a half-built graph already looks scattered.
  const cells = Array.from({ length: cols * rows }, (_, index) => index);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = cells[index];
    cells[index] = cells[swap];
    cells[swap] = held;
  }

  const nodes = labels.map((label, index) => {
    const cell = cells[index % cells.length];
    const row = Math.floor(cell / cols);
    const column = cell % cols;
    let x = band.left + cellW * (column + 0.5) + (random() - 0.5) * cellW * 0.62;
    let y = band.top + cellH * (row + 0.5) + (random() - 0.5) * cellH * 0.62;
    // Every fifth word sits further out, which gives the graph its long jumps.
    if (index % 5 === 4) {
      const outward = index % 10 === 4 ? -1 : 1;
      x += outward * cellW * 0.34;
      y += (random() - 0.5) * cellH * 0.7;
    }
    x = Math.min(Math.max(x, safe.left + 6), safe.right - 6);
    y = Math.min(Math.max(y, safe.top + 6), safe.bottom - 6);
    return { key: label.key, x, y, label };
  });

  const gap = 6;
  const boxes: Box[] = [];
  const placed: PlacedWord[] = nodes.map((node) => ({
    key: node.key,
    x: node.x,
    y: node.y,
    label: { x: node.x, y: node.y, w: node.label.width, h: node.label.height },
  }));

  const claim = (owner: number, box: Box) => {
    boxes.push(box);
    placed[owner] = { ...placed[owner], label: box };
  };

  const bounds: Bounds = { width, height, margins };

  nodes.forEach((node, index) => {
    const label = labels[index];
    const below = {
      x: node.x - label.width / 2,
      y: node.y + 10,
      w: label.width,
      h: label.height,
    };
    const above = { ...below, y: node.y - 10 - label.height };
    const preferred = below.y + label.height <= safe.bottom ? below : above;
    claim(index, placeWithoutOverlap(preferred, boxes, bounds, gap));
  });

  // Final separation: if the candidate ring could not clear a box, push the two
  // apart along the axis with the least overlap until nothing intersects.
  for (let pass = 0; pass < 240; pass += 1) {
    let moved = false;
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        const a = boxes[first];
        const b = boxes[second];
        if (overlapArea(a, b, gap) === 0) continue;
        const pushDown = a.y + a.h + gap - b.y;
        const pushUp = b.y + b.h + gap - a.y;
        const pushRight = a.x + a.w + gap - b.x;
        const pushLeft = b.x + b.w + gap - a.x;
        const smallest = Math.min(pushDown, pushUp, pushRight, pushLeft);
        const movedBox = { ...b };
        if (smallest === pushDown) movedBox.y += pushDown;
        else if (smallest === pushUp) movedBox.y -= pushUp;
        else if (smallest === pushRight) movedBox.x += pushRight;
        else movedBox.x -= pushLeft;
        boxes[second] = clampBox(movedBox, safe.left, safe.top, safe.right, safe.bottom);
        moved = true;
      }
    }
    if (!moved) break;
  }

  boxes.forEach((box, index) => {
    placed[index] = { ...placed[index], label: box };
  });

  return placed;
}
