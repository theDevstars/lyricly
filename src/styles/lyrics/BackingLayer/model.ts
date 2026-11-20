/** Splits a line into the lead vocal and any parenthesised backing part. */
export function splitBacking(text: string): { lead: string; backing: string } {
  const match = /^(.*?)[（(]([^）)]*)[）)](.*)$/.exec(text);
  if (!match) return { lead: text.trim(), backing: '' };
  const lead = `${match[1]}${match[3]}`.replace(/\s+/g, ' ').trim();
  return { lead, backing: match[2].trim() };
}

/** A line that is entirely backing, e.g. "(oh oh oh)". */
export const isBackingOnly = (text: string): boolean => {
  const { lead, backing } = splitBacking(text);
  return backing.length > 0 && lead.length === 0;
};

/** Font size for the backing layer relative to the lead. */
export const backingScale = (lead: string, backing: string): number =>
  lead.length > 0 && backing.length > 0 ? 0.52 : 0.82;
