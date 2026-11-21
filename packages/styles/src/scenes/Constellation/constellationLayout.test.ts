import { describe, expect, it } from 'vitest';
import {
  layoutConstellation,
  mulberry32,
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

function input(seed: number, width: number, height: number, count: number, activeIndex: number): LayoutInput {
  return {
    width,
    height,
    seed,
    labels: labelsFor(seed + count, count),
    activeIndex,
    active: { width: 300, height: 80 },
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
    const first = layoutConstellation(input(1234, 1920, 1080, 14, 4));
    const second = layoutConstellation(input(1234, 1920, 1080, 14, 4));
    expect(first).toEqual(second);
  });

  it('draws a different graph for a different seed', () => {
    const first = layoutConstellation(input(1234, 1920, 1080, 14, 4));
    const second = layoutConstellation(input(9999, 1920, 1080, 14, 4));
    const moved = first.filter((node, index) => Math.abs(node.y - second[index].y) > 1);
    expect(moved.length).toBeGreaterThan(3);
  });

  it('never overlaps labels across 200 sampled lines', () => {
    for (let sample = 0; sample < 200; sample += 1) {
      const random = mulberry32(sample * 31 + 7);
      const count = 12 + Math.floor(random() * 7);
      const [width, height] = SIZES[sample % SIZES.length];
      const activeIndex = Math.floor(random() * count);
      const layout = layoutConstellation(input(sample + 1, width, height, count, activeIndex));

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
      const layout = layoutConstellation(input(sample + 3, width, height, count, count - 1));
      const margins = input(sample + 3, width, height, count, count - 1).margins;
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

  it('shifts the active label inward while its star stays on the node', () => {
    const base = input(77, 1280, 720, 16, -1);
    const withoutActive = layoutConstellation(base);
    const rightmost = withoutActive.reduce((best, node, index) => (node.x > withoutActive[best].x ? index : best), 0);
    const withActive = layoutConstellation({ ...base, activeIndex: rightmost });

    expect(withActive[rightmost].x).toBeCloseTo(withoutActive[rightmost].x, 6);
    expect(withActive[rightmost].active).toBe(true);
    expect(withActive[rightmost].label.x).toBeGreaterThanOrEqual(base.margins.left);
    expect(withActive[rightmost].label.x + withActive[rightmost].label.w).toBeLessThanOrEqual(1280 - base.margins.right);
  });

  it('fits the same seed onto two monitors', () => {
    const small = layoutConstellation(input(4242, 1280, 720, 15, 5));
    const large = layoutConstellation(input(4242, 1920, 1080, 15, 5));
    expect(small).toHaveLength(15);
    expect(large).toHaveLength(15);
    expect(small.map((node) => node.key)).toEqual(large.map((node) => node.key));
    // Same graph shape, different scale: not pixel identical, both in bounds.
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
