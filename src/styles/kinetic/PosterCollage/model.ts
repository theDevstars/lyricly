export interface Placement {
  /** 0..1 relative slot inside the poster. */
  x: number;
  y: number;
  /** Multiplier on the base size. */
  scale: number;
  weight: number;
  italic: boolean;
}

/** Deterministic composition for a verse: same verse, same poster. */
export function compose(texts: string[], seed: number): Placement[] {
  let state = seed || 1;
  const random = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };

  const columns = texts.length > 12 ? 4 : texts.length > 6 ? 3 : 2;
  return texts.map((text, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const stagger = row % 2 === 0 ? 0 : 0.06;
    return {
      x: (column + 0.5) / columns + stagger,
      y: 0.16 + (row / Math.max(1, Math.ceil(texts.length / columns))) * 0.68,
      scale: 0.62 + random() * 0.7 + Math.min(0.4, text.length * 0.02),
      weight: random() > 0.55 ? 800 : random() > 0.3 ? 600 : 400,
      italic: random() > 0.82,
    };
  });
}
