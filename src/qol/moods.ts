import { STYLES } from '../styles/registry';

export type Mood = 'calm' | 'steady' | 'high';

/** Which pool a song's energy selects when "style by mood" is on. */
export const MOODS: Record<Mood, string[]> = {
  calm: ['context-window', 'full-verse', 'echo-trail', 'subtitle-cinema'],
  steady: ['karaoke-sweep', 'liquid-type', 'orbit', 'backing-layer', 'sections'],
  high: ['glitch-vhs', 'tunnel', 'gravity-drop', 'waveform-words', 'piano-roll', 'group-chat'],
};

/** Energy level (0..1) to a mood bucket. */
export const moodOf = (level: number): Mood => (level < 0.34 ? 'calm' : level < 0.68 ? 'steady' : 'high');

/** The pool for a mood, filtered to styles that actually exist. */
export const poolFor = (mood: Mood): string[] => {
  const ids = new Set(STYLES.map((style) => style.id));
  return MOODS[mood].filter((id) => ids.has(id));
};

/** A style from the pool that is not the one playing. */
export function pick(pool: string[], current: string, random = Math.random): string | null {
  const options = pool.filter((id) => id !== current);
  if (options.length === 0) return pool[0] ?? null;
  return options[Math.floor(random() * options.length)] ?? null;
}
