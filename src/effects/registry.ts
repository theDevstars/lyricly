import type { LyricStyle, StyleState } from '../styles/types';

export interface Effect {
  id: string;
  name: string;
  description: string;
  /** Effects that flash are skipped when photosensitivity is on. */
  flashing?: boolean;
}

/** Every shared effect, independent of each other. */
export const EFFECTS: Effect[] = [
  { id: 'beat', name: 'Beat-synced motion', description: 'Words pulse with the section energy.', flashing: true },
  { id: 'emphasis', name: 'Emphasis', description: 'Held and repeated words get bigger and brighter.' },
  { id: 'chorus', name: 'Chorus lift', description: 'Repeated lines get a bigger, brighter treatment.' },
  { id: 'particles', name: 'Word particles', description: 'Sparks lift off the word being sung.' },
  { id: 'parallax', name: 'Depth drift', description: 'The frame drifts gently with the mouse.' },
  { id: 'reactive', name: 'Reactive background', description: 'Background light follows the song energy.' },
  { id: 'rhyme', name: 'Rhyme colour', description: 'Words that rhyme share a colour.' },
];

/** Styles that support each effect; empty means every style that opts in. */
export const SUPPORT: Record<string, string[]> = {
  beat: ['karaoke-sweep', 'liquid-type', 'orbit', 'waveform-words', 'neon-sign', 'piano-roll', 'group-chat'],
  particles: ['karaoke-sweep', 'gravity-drop', 'tunnel', 'waveform-words', 'glitch-vhs', 'piano-roll'],
  reactive: ['tunnel', 'waveform-words', 'glitch-vhs', 'echo-trail', 'lyric-wall', 'context-window'],
  rhyme: ['poster-collage', 'full-verse', 'lyric-wall', 'sections'],
};

/** Effects switched on for this style, filtered to what it supports. */
export function effectsFor(style: LyricStyle, enabled: Record<string, string> | undefined): Effect[] {
  if (!enabled) return [];
  return EFFECTS.filter((effect) => {
    const supported = SUPPORT[effect.id];
    if (supported && supported.length > 0 && !supported.includes(style.id)) return false;
    return enabled[effect.id] === 'on';
  });
}

export const safeEffects = (effects: Effect[], state: StyleState): Effect[] =>
  state.photosensitive ? effects.filter((effect) => !effect.flashing) : effects;
