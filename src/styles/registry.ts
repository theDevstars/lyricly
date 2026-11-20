import { fisheye, fisheyeVisual } from './kinetic/fisheye';
import { ship } from './kinetic/ship';
import { visual } from './kinetic/visual';
import { codestyle, codestyleVisual } from './scenes/codestyle';
import { constellation } from './scenes/constellation';
import { branches } from './scenes/branches';
import { web } from './scenes/web';
import { messages } from './scenes/messages';
import { money } from './native/money';
import { map } from './native/map';
import { notifications } from './native/notifications';
import type { LyricStyle, StyleGroup } from './types';

export const STYLES: LyricStyle[] = [
  ship,
  fisheye,
  visual,
  fisheyeVisual,
  codestyle,
  codestyleVisual,
  branches,
  web,
  constellation,
  messages,
  money,
  map,
  notifications,
];

export const GROUPS: { id: StyleGroup; title: string; blurb: string }[] = [
  { id: 'kinetic', title: 'Kinetic type', blurb: 'The words themselves move' },
  { id: 'scenes', title: 'Motion scenes', blurb: 'The words draw a picture as they go' },
  { id: 'native', title: 'Native Design', blurb: 'The lyric as an interface you know' },
];

export function getStyle(id: string): LyricStyle {
  return STYLES.find((style) => style.id === id) ?? STYLES[0];
}

export function stylesIn(group: StyleGroup): LyricStyle[] {
  return STYLES.filter((style) => style.group === group);
}
