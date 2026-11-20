import type { LyricLine } from '../../../types';
import { detectSections, repeats } from '../../lib/sections';

export interface SectionView {
  label: string;
  chorus: boolean;
  lines: { text: string; mark: string }[];
}

/** The section that contains the active line, as rows ready to draw. */
export function currentSection(lines: LyricLine[], activeIndex: number): SectionView | null {
  if (lines.length === 0) return null;
  const sections = detectSections(lines);
  const active = sections[Math.max(0, activeIndex)];
  if (!active) return null;

  const marks = repeats(lines);
  const group = sections.filter((section) => section.label === active.label);
  const first = group[0]?.lineIndex ?? active.lineIndex;

  const rows = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => entry.index >= first && sections[entry.index]?.label === active.label)
    .filter((entry) => !marks[entry.index].collapsed)
    .filter((entry) => entry.line.text.trim() !== '' && !/^[[(].*[\])]$/.test(entry.line.text))
    .slice(0, 8)
    .map((entry) => ({
      text: entry.line.text,
      mark: marks[entry.index].count > 1 ? `×${marks[entry.index].count}` : '',
    }));

  return { label: active.label || 'Verse', chorus: active.chorus, lines: rows };
}
