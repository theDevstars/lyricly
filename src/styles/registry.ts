import { fisheye, fisheyeVisual } from './kinetic/fisheye';
import { ship } from './kinetic/ship';
import { visual } from './kinetic/visual';
import { codestyle, codestyleVisual } from './scenes/codestyle';
import type { LyricStyle, StyleGroup } from './types';

export const STYLES: LyricStyle[] = [
  ship,
  fisheye,
  visual,
  fisheyeVisual,
  codestyle,
  codestyleVisual,
];

export const GROUPS: { id: StyleGroup; title: string; blurb: string }[] = [
  { id: 'kinetic', title: 'Kinetic type', blurb: 'The words themselves move' },
  { id: 'scenes', title: 'Motion scenes', blurb: 'The words draw a picture as they go' },
];

export function getStyle(id: string): LyricStyle {
  return STYLES.find((style) => style.id === id) ?? STYLES[0];
}

export function stylesIn(group: StyleGroup): LyricStyle[] {
  return STYLES.filter((style) => style.group === group);
}
