export interface Note {
  lineIndex: number;
  x: number;
  y: number;
  tilt: number;
  /** 0..1 how fresh the note is; older notes peel away. */
  life: number;
}

/** Notes for the last few lines, arranged on a wall, newest last. */
export function wallFor(activeIndex: number, width: number, height: number, count = 5): Note[] {
  const notes: Note[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const lineIndex = activeIndex - count + 1 + offset;
    if (lineIndex < 0) continue;
    const hash = Math.sin(lineIndex * 12.9898) * 43758.5453;
    const unit = hash - Math.floor(hash);
    notes.push({
      lineIndex,
      x: width * (0.18 + unit * 0.64),
      y: height * (0.28 + ((Math.sin(lineIndex * 78.233) + 1) / 2) * 0.34),
      tilt: (unit - 0.5) * 0.22,
      life: Math.min(1, (offset + 1) / count),
    });
  }
  return notes;
}

/** How far a note has peeled off the wall, 0..1. */
export const peel = (life: number): number => Math.max(0, 1 - life);
