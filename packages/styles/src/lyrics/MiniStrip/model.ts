/** Font size for a strip of this height. */
export const stripSize = (height: number): number => Math.max(11, Math.min(height * 0.42, 30));

/** Whether the stage is short enough to be treated as a strip. */
export const isStrip = (height: number, width: number): boolean => height < 120 || height / width < 0.2;

/** Text of the next line, for the optional second row. */
export const nextLineText = (lines: { text: string }[], activeIndex: number): string => {
  for (let index = activeIndex + 1; index < lines.length; index += 1) {
    if (lines[index].text.trim()) return lines[index].text;
  }
  return '';
};

/** Fit a line into the strip, trimming rather than overflowing. */
export function trim(
  text: string,
  measure: (value: string) => number,
  maxWidth: number,
): string {
  if (measure(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 4 && measure(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -2);
  }
  return `${cut}…`;
}
