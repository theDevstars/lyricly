export const FOCAL = 520;

export interface Projected {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

/** Projects a point at depth z onto the stage. */
export function project(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
): Projected {
  if (z <= 1) return { x: width / 2, y: height / 2, scale: 0, visible: false };
  const scale = FOCAL / z;
  return {
    x: width / 2 + x * scale,
    y: height / 2 + y * scale,
    scale,
    visible: z > 8 && z < 2600,
  };
}

/** Depth of a word: sung words rush past the camera. */
export function depthOf(wordIndex: number, activeWord: number, progress: number): number {
  const gap = wordIndex - Math.max(0, activeWord);
  return Math.max(20, 460 + gap * 320 - progress * 300);
}

/** Deterministic star positions for the field. */
export function stars(count: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = 0; index < count; index += 1) {
    out.push({ x: (random() - 0.5) * 1800, y: (random() - 0.5) * 1200, z: random() * 2400 + 20 });
  }
  return out;
}
