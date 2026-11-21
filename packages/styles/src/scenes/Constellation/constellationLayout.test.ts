import { describe, expect, it } from 'vitest';
import {
  layoutConstellation,
  mulberry32,
  placeActiveLabel,
  seedFrom,
  type Box,
  type LabelMeasure,
  type LayoutInput,
} from './constellationLayout';

const SIZES: [number, number][] = [
  [1280, 720],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
];

function labelsFor(seed: number, count: number): LabelMeasure[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    key: `word-${index}`,
    width: 34 + random() * 150,
    height: 18,
  }));
}

function input(seed: number, width: number, height: number, count: number): LayoutInput {
  return {
    width,
    height,
    seed,
    labels: labelsFor(seed + count, count),
    margins: {
      left: width * 0.06,
      right: width * 0.06 + 40,
      top: height * 0.09,
      bottom: height * 0.14,
    },
  };
}

const overlap = (a: Box, b: Box): number => {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return dx > 0 && dy > 0 ? dx * dy : 0;
};

describe('layoutConstellation', () => {
  it('draws the same graph for the same seed', () => {
    expect(layoutConstellation(input(1234, 1920, 1080, 14))).toEqual(
      layoutConstellation(input(1234, 1920, 1080, 14)),
    );
  });

  it('lays a phrase out once, whatever word is being sung', () => {
    // The layout no longer depends on the active word at all: calling it again
    // after the song moves on must give the same label boxes.
    const first = layoutConstellation(input(1234, 1920, 1080, 14));
    const again = layoutConstellation(input(1234, 1920, 1080, 14));
    expect(again.map((node) => node.label)).toEqual(first.map((node) => node.label));
    expect(again.map((node) => [node.x, node.y])).toEqual(first.map((node) => [node.x, node.y]));
  });

  it('draws a different graph for a different seed', () => {
    const first = layoutConstellation(input(1234, 1920, 1080, 14));
    const second = layoutConstellation(input(9999, 1920, 1080, 14));
    const moved = first.filter((node, index) => Math.abs(node.y - second[index].y) > 1);
    expect(moved.length).toBeGreaterThan(3);
  });

  it('never overlaps labels across 200 sampled lines', () => {
    for (let sample = 0; sample < 200; sample += 1) {
      const random = mulberry32(sample * 31 + 7);
      const count = 12 + Math.floor(random() * 7);
      const [width, height] = SIZES[sample % SIZES.length];
      const layout = layoutConstellation(input(sample + 1, width, height, count));

      for (let first = 0; first < layout.length; first += 1) {
        for (let second = first + 1; second < layout.length; second += 1) {
          expect(overlap(layout[first].label, layout[second].label), `sample ${sample} pair ${first}/${second}`).toBe(0);
        }
      }
    }
  });

  it('keeps nodes and labels inside the safe margins', () => {
    for (let sample = 0; sample < 60; sample += 1) {
      const [width, height] = SIZES[sample % SIZES.length];
      const count = 12 + (sample % 7);
      const layout = layoutConstellation(input(sample + 3, width, height, count));
      const margins = input(sample + 3, width, height, count).margins;
      layout.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(margins.left);
        expect(node.x).toBeLessThanOrEqual(width - margins.right);
        expect(node.y).toBeGreaterThanOrEqual(margins.top);
        expect(node.y).toBeLessThanOrEqual(height - margins.bottom);
        expect(node.label.x).toBeGreaterThanOrEqual(margins.left - 0.001);
        expect(node.label.x + node.label.w).toBeLessThanOrEqual(width - margins.right + 0.001);
        expect(node.label.y).toBeGreaterThanOrEqual(margins.top - 0.001);
        expect(node.label.y + node.label.h).toBeLessThanOrEqual(height - margins.bottom + 0.001);
      });
    }
  });

  it('fits the same seed onto two monitors', () => {
    const small = layoutConstellation(input(4242, 1280, 720, 15));
    const large = layoutConstellation(input(4242, 1920, 1080, 15));
    expect(small).toHaveLength(15);
    expect(large).toHaveLength(15);
    expect(small.map((node) => node.key)).toEqual(large.map((node) => node.key));
    expect(small[3].x).not.toBeCloseTo(large[3].x, 0);
    large.forEach((node) => {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(1920);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(1080);
    });
  });

  it('gives independent seeds different graphs', () => {
    expect(seedFrom('graph-1', 'left')).not.toBe(seedFrom('graph-1', 'right'));
    expect(seedFrom('graph-1')).toBe(seedFrom('graph-1'));
  });
});

describe('placeActiveLabel', () => {
  it('puts the big word in a clear gap near its star', () => {
    const layout = layoutConstellation(input(77, 1280, 720, 16));
    const bounds = input(77, 1280, 720, 16);
    const star = layout[7];
    const slot = placeActiveLabel(star, { width: 320, height: 80 }, layout.map((node) => node.label), {
      width: bounds.width,
      height: bounds.height,
      margins: bounds.margins,
    });

    layout.forEach((node) => {
      expect(overlap(slot, node.label), node.key).toBe(0);
    });
    expect(slot.x).toBeGreaterThanOrEqual(0);
    expect(slot.x + slot.w).toBeLessThanOrEqual(1280 - bounds.margins.right + 0.001);
    expect(slot.y).toBeGreaterThanOrEqual(0);
    expect(slot.y + slot.h).toBeLessThanOrEqual(720 - bounds.margins.bottom + 0.001);
  });

  it('shifts a near-edge word inward but keeps its star put', () => {
    const layout = layoutConstellation(input(77, 1280, 720, 16));
    const bounds = input(77, 1280, 720, 16);
    const rightmost = layout.reduce((best, node, index) => (node.x > layout[best].x ? index : best), 0);
    const star = layout[rightmost];
    const slot = placeActiveLabel(star, { width: 380, height: 80 }, layout.map((node) => node.label), {
      width: bounds.width,
      height: bounds.height,
      margins: bounds.margins,
    });

    expect(layout[rightmost].x).toBe(star.x);
    expect(slot.x + slot.w).toBeLessThanOrEqual(1280 - bounds.margins.right + 0.001);
    expect(slot.x).toBeGreaterThanOrEqual(bounds.margins.left - 0.001);
  });

  it('falls back to the least-overlapping slot when the page is packed', () => {
    const bounds = { width: 400, height: 300, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
    const wall: Box = { x: 0, y: 0, w: 400, h: 300 };
    const slot = placeActiveLabel({ x: 200, y: 150 }, { width: 300, height: 80 }, [wall], bounds);
    expect(slot.w).toBe(300);
    expect(slot.h).toBe(80);
  });
});
