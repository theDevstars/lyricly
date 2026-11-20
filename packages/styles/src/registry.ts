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
import { karaokeSweep } from './kinetic/KaraokeSweep';
import { liquidType } from './kinetic/LiquidType';
import { gravityDrop } from './kinetic/GravityDrop';
import { orbit } from './kinetic/Orbit';
import { tunnel } from './kinetic/Tunnel';
import { posterCollage } from './kinetic/PosterCollage';
import { waveformWords } from './scenes/WaveformWords';
import { neonSign } from './scenes/NeonSign';
import { typewriter } from './scenes/Typewriter';
import { handwriting } from './scenes/Handwriting';
import { glitchVhs } from './scenes/GlitchVHS';
import { terminal } from './scenes/Terminal';
import { pianoRoll } from './scenes/PianoRoll';
import { subtitleCinema } from './scenes/SubtitleCinema';
import { groupChat } from './native/GroupChat';
import { stories } from './native/Stories';
import { stickyNotes } from './native/StickyNotes';
import { contextWindow } from './lyrics/ContextWindow';
import { fullVerse } from './lyrics/FullVerse';
import { lyricWall } from './lyrics/LyricWall';
import { echoTrail } from './lyrics/EchoTrail';
import { backingLayer } from './lyrics/BackingLayer';
import { sectionsStyle } from './lyrics/Sections';
import { multiLanguage } from './lyrics/MultiLanguage';
import { dualScreenSplit } from './lyrics/DualScreenSplit';
import { miniStrip } from './lyrics/MiniStrip';
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
  karaokeSweep,
  liquidType,
  gravityDrop,
  orbit,
  tunnel,
  posterCollage,
  waveformWords,
  neonSign,
  typewriter,
  handwriting,
  glitchVhs,
  terminal,
  pianoRoll,
  subtitleCinema,
  groupChat,
  stories,
  stickyNotes,
  contextWindow,
  fullVerse,
  lyricWall,
  echoTrail,
  backingLayer,
  sectionsStyle,
  multiLanguage,
  dualScreenSplit,
  miniStrip,
];

export const GROUPS: { id: StyleGroup; title: string; blurb: string }[] = [
  { id: 'kinetic', title: 'Kinetic type', blurb: 'The words themselves move' },
  { id: 'scenes', title: 'Motion scenes', blurb: 'The words draw a picture as they go' },
  { id: 'native', title: 'Native Design', blurb: 'The lyric as an interface you know' },
  { id: 'lyrics', title: 'More lyrics', blurb: 'More of the song on screen at once' },
];

export function getStyle(id: string): LyricStyle {
  return STYLES.find((style) => style.id === id) ?? STYLES[0];
}

export function stylesIn(group: StyleGroup): LyricStyle[] {
  return STYLES.filter((style) => style.group === group);
}
