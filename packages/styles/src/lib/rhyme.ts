const vowels = /[aeiouyà-ÿ]+/gi;

/** Last vowel run and trailing consonants: what actually rhymes. */
export function rhymeKey(word: string): string {
  const clean = word.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (clean.length < 2) return '';
  const matches = clean.match(vowels);
  if (!matches || matches.length === 0) return clean.slice(-2);
  const last = matches[matches.length - 1];
  const at = clean.lastIndexOf(last);
  return clean.slice(at);
}

/** Rhyme families for a list of words, as group indices (0 = first family). */
export function rhymeGroups(words: string[]): number[] {
  const families: string[][] = [];
  return words.map((word) => {
    const key = rhymeKey(word);
    if (!key) return -1;
    for (let group = 0; group < families.length; group += 1) {
      if (families[group].some((sample) => sample === key || sample.endsWith(key) || key.endsWith(sample))) {
        families[group].push(key);
        return group;
      }
    }
    families.push([key]);
    return families.length - 1;
  });
}

/** True when two words rhyme closely enough to colour together. */
export function rhymes(a: string, b: string): boolean {
  const left = rhymeKey(a);
  const right = rhymeKey(b);
  if (!left || !right) return false;
  if (left.length < 2 || right.length < 2) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
}
