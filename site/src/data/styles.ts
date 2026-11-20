import { GROUPS, STYLES } from "@lyrica/styles";
import type { LyricStyle, StyleGroup as StyleGroupId, StyleTraits } from "@lyrica/styles";
import { traitsFor } from "./style-traits";

const GROUP_COPY: Record<
  string,
  { index: string; eyebrow: string; title: string; subtitle: string; note?: string; accent?: boolean }
> = {
  kinetic: {
    index: "01",
    eyebrow: "Kinetic type",
    title: "Kinetic type",
    subtitle: "The words themselves move.",
  },
  scenes: {
    index: "02",
    eyebrow: "Motion scenes",
    title: "Motion scenes",
    subtitle: "The words draw a picture as they go.",
  },
  native: {
    index: "03",
    eyebrow: "Native Design",
    title: "Native Design",
    subtitle: "The lyric as an interface you know.",
    note: "These keep their own colors, whatever you set in Aesthetics.",
    accent: true,
  },
  lyrics: {
    index: "04",
    eyebrow: "Lyric-first",
    title: "Lyric-first",
    subtitle: "Just the words, held still enough to read.",
  },
};

export type StyleItem = {
  slug: string;
  name: string;
  description: string;
  gradient: string;
  group: string;
  groupId: StyleGroupId;
  isNew: boolean;
  traits: StyleTraits;
  colorMode: "theme" | "fixed";
  background: "stage" | "own";
  media?: LyricStyle["media"];
  renderer: LyricStyle;
};

export type StyleGroupView = {
  id: StyleGroupId;
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  note?: string;
  isNew?: boolean;
  accent?: boolean;
  styles: StyleItem[];
};

export const allStyles: StyleItem[] = STYLES.map((style) => {
  const copy = GROUP_COPY[style.group] ?? GROUP_COPY.lyrics;
  return {
    slug: style.id,
    name: style.name,
    description: style.description,
    gradient: `linear-gradient(135deg, ${style.gradient[0]} 0%, ${style.gradient[1]} 100%)`,
    group: style.eyebrow ?? copy.title,
    groupId: style.group,
    isNew: Boolean(style.isNew || style.introducedIn),
    traits: traitsFor(style.id, style.group, style.traits),
    colorMode: style.colorMode ?? "theme",
    background: style.background ?? "own",
    media: style.media,
    renderer: style,
  };
});

export const styleGroups: StyleGroupView[] = GROUPS.map((group) => {
  const copy = GROUP_COPY[group.id] ?? GROUP_COPY.lyrics;
  const styles = allStyles.filter((style) => style.groupId === group.id);
  return {
    id: group.id,
    ...copy,
    isNew: styles.some((style) => style.isNew),
    styles,
  };
}).filter((group) => group.styles.length > 0);

export const styleCount = allStyles.length;

export const getStyleItem = (id: string): StyleItem | undefined =>
  allStyles.find((style) => style.slug === id);

export const getStyleItems = (ids: string[]): StyleItem[] =>
  ids.map((id) => getStyleItem(id)).filter((style): style is StyleItem => Boolean(style));
