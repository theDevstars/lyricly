import { describe, expect, it } from 'vitest';
import type { LyricLine } from '../../types';
import {
  buildGraphs,
  GHOST_LEAD_MS,
  graphAt,
  graphState,
  LINK_REVEAL_MS,
  linkReveal,
  linksOf,
  MAX_GRAPH_WORDS,
  MIN_GRAPH_WORDS,
  RETIRE_MS,
  TRANSITION_MS,
  transitionAmount,
} from './graphModel';

function lineFrom(words: string[], startMs: number): LyricLine {
  return {
    startMs,
    endMs: startMs + words.length * 500,
    text: words.join(' '),
    exact: true,
    words: words.map((text, index) => ({
      text,
      startMs: startMs + index * 500,
      endMs: startMs + index * 500 + 450,
    })),
  };
}

const eight = ['the', 'city', 'knows', 'she', 'shorts..', 'high-', 'about,', 'me'];

describe('buildGraphs', () => {
  it('groups a song into phrase graphs of twelve to eighteen words', () => {
    const lines = Array.from({ length: 6 }, (_, index) =>
      lineFrom(['one', 'two', 'three', 'four', 'five'], index * 3000),
    );
    const graphs = buildGraphs(lines);
    expect(graphs.length).toBeGreaterThan(1);
    graphs.slice(0, -1).forEach((graph) => {
      expect(graph.words.length).toBeGreaterThanOrEqual(MIN_GRAPH_WORDS);
      expect(graph.words.length).toBeLessThanOrEqual(MAX_GRAPH_WORDS);
    });
    expect(graphs[graphs.length - 1].words.length).toBeLessThanOrEqual(MAX_GRAPH_WORDS);
  });

  it('is deterministic for the same lines', () => {
    const lines = Array.from({ length: 4 }, (_, index) => lineFrom(eight, index * 4000));
    expect(buildGraphs(lines)).toEqual(buildGraphs(lines));
  });

  it('keeps punctuation attached to its word', () => {
    const graphs = buildGraphs([lineFrom(eight, 1000)]);
    const texts = graphs[0].words.map((word) => word.text);
    expect(texts).toContain('shorts..');
    expect(texts).toContain('high-');
    expect(texts).toContain('about,');
  });
});

describe('links', () => {
  it('connects words in singing order', () => {
    const graph = buildGraphs([lineFrom(eight, 1000)])[0];
    const links = linksOf(graph);
    expect(links.map((link) => link.to)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(links.map((link) => link.from)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    links.forEach((link) => {
      expect(graph.words[link.to].startMs).toBeGreaterThanOrEqual(graph.words[link.from].startMs);
    });
  });

  it('reveals each link over 250ms from its word start', () => {
    const graph = buildGraphs([lineFrom(eight, 1000)])[0];
    const start = graph.words[2].startMs;
    expect(linkReveal(graph, 2, start - 1)).toBe(0);
    expect(linkReveal(graph, 2, start + LINK_REVEAL_MS / 2)).toBeCloseTo(0.5, 2);
    expect(linkReveal(graph, 2, start + LINK_REVEAL_MS)).toBe(1);
    expect(linkReveal(graph, 0, start)).toBe(0);
  });
});

describe('word phases', () => {
  const graph = buildGraphs([lineFrom(['about,', 'the', 'shorts..', 'high-'], 1000)])[0];

  it('moves hidden to ghost to active to settled at exact timestamps', () => {
    const [first] = graph.words;
    expect(graphState(graph, first.startMs - GHOST_LEAD_MS - 1).words[0].phase).toBe('hidden');
    expect(graphState(graph, first.startMs - GHOST_LEAD_MS).words[0].phase).toBe('ghost');
    expect(graphState(graph, first.startMs - 1).words[0].phase).toBe('ghost');
    expect(graphState(graph, first.startMs).words[0].phase).toBe('active');
    expect(graphState(graph, first.endMs - 1).words[0].phase).toBe('active');
    expect(graphState(graph, first.endMs).words[0].phase).toBe('settled');
  });

  it('never has two active words', () => {
    const start = graph.startMs - GHOST_LEAD_MS;
    const end = graph.endMs + 200;
    for (let position = start; position <= end; position += 7) {
      const state = graphState(graph, position);
      expect(state.words.filter((word) => word.phase === 'active').length).toBeLessThanOrEqual(1);
    }
  });

  it('hands the previous word the secondary slot', () => {
    const state = graphState(graph, graph.words[2].startMs + 20);
    expect(state.activeIndex).toBe(2);
    expect(state.secondaryIndex).toBe(1);
    expect(state.words[1].secondary).toBe(true);
    expect(state.words[1].phase).toBe('settled');
  });

  it('has no secondary word between lines', () => {
    const state = graphState(graph, graph.endMs + 200);
    expect(state.activeIndex).toBe(-1);
    expect(state.secondaryIndex).toBe(-1);
    expect(state.words.every((word) => word.phase === 'settled')).toBe(true);
  });

  it('treats a seek like playback: earlier words settled, current active', () => {
    const state = graphState(graph, graph.words[3].startMs + 10);
    expect(state.words.map((word) => word.phase)).toEqual(['settled', 'settled', 'settled', 'active']);
    expect(state.activeIndex).toBe(3);
  });

  it('reports the same active word for both monitors on one playhead', () => {
    for (let position = graph.startMs; position < graph.endMs; position += 37) {
      const left = graphState(graph, position).activeIndex;
      const right = graphState(graph, position).activeIndex;
      expect(left).toBe(right);
    }
  });
});

describe('graph lifecycle', () => {
  const lines = [
    lineFrom(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 1000),
    lineFrom(['m', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x'], 9000),
  ];
  const graphs = buildGraphs(lines);

  it('retires the previous graph over 600ms', () => {
    expect(graphs).toHaveLength(2);
    const start = graphs[1].startMs;
    expect(graphAt(graphs, start)?.previousFade).toBe(0);
    expect(graphAt(graphs, start + RETIRE_MS / 2)?.previousFade).toBeCloseTo(0.5, 2);
    expect(graphAt(graphs, start + RETIRE_MS)?.previousFade).toBe(1);
    expect(graphAt(graphs, start)?.previous?.id).toBe(graphs[0].id);
  });

  it('holds no graph before the first word', () => {
    expect(graphAt(graphs, 0)).toBeNull();
  });

  it('smears for 400ms at the handover, and not at all with reduced motion', () => {
    const start = graphs[1].startMs;
    expect(transitionAmount(graphs[1], start)).toBe(1);
    expect(transitionAmount(graphs[1], start + TRANSITION_MS / 2)).toBeCloseTo(0.5, 2);
    expect(transitionAmount(graphs[1], start + TRANSITION_MS)).toBe(0);
    expect(transitionAmount(graphs[1], start, true)).toBe(0);
  });
});
