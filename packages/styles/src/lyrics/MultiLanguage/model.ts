export interface Row {
  text: string;
  kind: 'original' | 'romanization' | 'translation';
}

/**
 * Lyrics carry one string per line. Translations travel as "original / translation"
 * inside that string, and a third segment is treated as a romanisation. When
 * there is only one segment the style shows a single row.
 */
export function rowsFor(text: string): Row[] {
  const parts = text.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) return [{ text: parts[0], kind: 'original' }];
  if (parts.length === 2) {
    return [
      { text: parts[0], kind: 'original' },
      { text: parts[1], kind: 'translation' },
    ];
  }
  return [
    { text: parts[0], kind: 'original' },
    { text: parts[1], kind: 'romanization' },
    { text: parts[2], kind: 'translation' },
  ];
}

/** True when any row is machine translated, so the tag is honest. */
export const machineTranslated = (rows: Row[]): boolean =>
  rows.some((row) => row.kind === 'translation');

/** Sizes for each row, relative to the original. */
export const rowScale = (kind: Row['kind']): number =>
  kind === 'original' ? 1 : kind === 'romanization' ? 0.62 : 0.72;
