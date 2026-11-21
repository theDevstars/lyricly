import { clamp01, type LyricLine } from '../../types';
import { wordsOf } from '../../lib/text';

/**
 * The graph model: lyric lines and a playhead in, words and their life cycle
 * out. Everything here is pure — the renderer only draws what this returns, so
 * two monitors on the same playhead agree word for word.
 */

export type WordPhase = 'hidden' | 'ghost' | 'active' | 'settled';

export interface GraphWord {
  key: string;
  /** Exactly as the lyric wrote it, punctuation attached. */
  text: string;
  startMs: number;
  endMs: number;
  lineIndex: number;
  wordIndex: number;
}

export interface Graph {
  id: string;
  words: GraphWord[];
  startMs: number;
  endMs: number;
}

export interface GraphView {
  graph: Graph;
  previous: Graph | null;
  /** 0 at the new graph's first frame, 1 once the old one is gone. */
  previousFade: number;
}

export interface WordView {
  key: string;
  text: string;
  phase: WordPhase;
  /** The word that just finished, shown a notch smaller under the active one. */
  secondary: boolean;
}

export interface GraphState {
  words: WordView[];
  activeIndex: number;
  secondaryIndex: number;
}

/** A phrase group: about one or two lines, twelve to eighteen words. */
export const MIN_GRAPH_WORDS = 12;
export const MAX_GRAPH_WORDS = 18;
/** A node appears faintly just before its word is sung. */
export const GHOST_LEAD_MS = 130;
/** A link draws itself from the previous node in this time. */
export const LINK_REVEAL_MS = 250;
/** Old graph fades and drifts away over this long. */
export const RETIRE_MS = 600;
/** Label smear when a new graph takes over. */
export const TRANSITION_MS = 400;

function flatten(lines: LyricLine[]): GraphWord[] {
  const words: GraphWord[] = [];
  lines.forEach((line, lineIndex) => {
    wordsOf(line).forEach((word, wordIndex) => {
      words.push({
        key: `${lineIndex}:${wordIndex}:${word.startMs}`,
        text: word.text,
        startMs: word.startMs,
        endMs: Math.max(word.endMs, word.startMs + 1),
        lineIndex,
        wordIndex,
      });
    });
  });
  return words;
}

/**
 * Splits the song into graphs at line boundaries once a graph has enough words,
 * or mid-line at the hard cap. The same lines always produce the same graphs.
 */
export function buildGraphs(lines: LyricLine[]): Graph[] {
  const words = flatten(lines);
  const graphs: Graph[] = [];
  let current: GraphWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    graphs.push({
      id: `graph-${current[0].startMs}-${current[0].lineIndex}`,
      words: current,
      startMs: current[0].startMs,
      endMs: Math.max(...current.map((word) => word.endMs)),
    });
    current = [];
  };

  words.forEach((word, index) => {
    if (current.length >= MAX_GRAPH_WORDS) flush();
    const lineChanged = index > 0 && word.lineIndex !== words[index - 1].lineIndex;
    if (lineChanged && current.length >= MIN_GRAPH_WORDS) flush();
    current.push(word);
  });
  flush();

  return graphs;
}

/** The graph on screen at a moment, with the one it replaced still fading. */
export function graphAt(graphs: Graph[], positionMs: number): GraphView | null {
  let index = -1;
  for (let i = 0; i < graphs.length; i += 1) {
    if (graphs[i].startMs <= positionMs) index = i;
  }
  if (index < 0) return null;

  const graph = graphs[index];
  const previous = index > 0 ? graphs[index - 1] : null;
  const previousFade = previous ? clamp01((positionMs - graph.startMs) / RETIRE_MS) : 1;
  return { graph, previous, previousFade };
}

/**
 * Word phases at a timestamp. Derived only from the playhead, so a seek lands
 * exactly like ordinary playback: earlier words settled, the current one active.
 */
export function graphState(
  graph: Graph,
  positionMs: number,
  options: { ghostLeadMs?: number } = {},
): GraphState {
  const lead = options.ghostLeadMs ?? GHOST_LEAD_MS;
  let activeIndex = -1;
  graph.words.forEach((word, index) => {
    if (positionMs >= word.startMs && positionMs < word.endMs) activeIndex = index;
  });

  const words: WordView[] = graph.words.map((word, index) => {
    let phase: WordPhase = 'hidden';
    if (index === activeIndex) phase = 'active';
    else if (positionMs >= word.endMs) phase = 'settled';
    else if (positionMs >= word.startMs - lead) phase = 'ghost';
    return { key: word.key, text: word.text, phase, secondary: false };
  });

  // Only an active word has a secondary word under it; between words every
  // finished word is just a settled label.
  const secondaryIndex = activeIndex > 0 ? activeIndex - 1 : -1;
  if (secondaryIndex >= 0) {
    words[secondaryIndex] = { ...words[secondaryIndex], phase: 'settled', secondary: true };
  }

  return { words, activeIndex, secondaryIndex };
}

/** Links in singing order: word n-1 to word n. */
export function linksOf(graph: Graph): { from: number; to: number }[] {
  const links: { from: number; to: number }[] = [];
  for (let index = 1; index < graph.words.length; index += 1) {
    links.push({ from: index - 1, to: index });
  }
  return links;
}

/** 0..1 dash reveal for the link that arrives at `index`. */
export function linkReveal(graph: Graph, index: number, positionMs: number): number {
  if (index <= 0 || index >= graph.words.length) return 0;
  return clamp01((positionMs - graph.words[index].startMs) / LINK_REVEAL_MS);
}

/** 1 right at a graph handover, easing to 0 over TRANSITION_MS. */
export function transitionAmount(
  graph: Graph,
  positionMs: number,
  reduceMotion = false,
): number {
  if (reduceMotion) return 0;
  return clamp01(1 - (positionMs - graph.startMs) / TRANSITION_MS);
}

/** The node still worth drawing: the newest word that has started. */
export function latestWordIndex(graph: Graph, positionMs: number): number {
  let latest = -1;
  graph.words.forEach((word, index) => {
    if (positionMs >= word.startMs) latest = index;
  });
  return latest;
}
