export type RoadmapStatus = "planned" | "progress" | "shipped";

export type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  tag: string;
  version?: string;
};

export const roadmapColumns: { id: RoadmapStatus; title: string; blurb: string }[] = [
  { id: "planned", title: "Planned", blurb: "Written down, not started." },
  { id: "progress", title: "In progress", blurb: "Being built or tested now." },
  { id: "shipped", title: "Shipped", blurb: "In a release you can install." },
];

export const roadmapItems: RoadmapItem[] = [
  {
    id: "style-library",
    title: "Expand the style library",
    description: "More kinetic, scene and lyric-first styles, each with a live preview and reduced-motion frame.",
    status: "progress",
    tag: "Styles",
    version: "2.x",
  },
  {
    id: "creator-flow",
    title: "Creator palette submissions",
    description: "A reviewed submission path for shared palettes and presets, with credit and removal on request.",
    status: "planned",
    tag: "Community",
  },
  {
    id: "docs",
    title: "Searchable documentation",
    description: "Short pages for settings, styles, accounts, streaming, hotkeys and the command palette.",
    status: "progress",
    tag: "Docs",
  },
  {
    id: "reviews",
    title: "Verified review wall",
    description: "A wall of quotes only when each one can be linked to a public, verifiable source.",
    status: "planned",
    tag: "Trust",
  },
  {
    id: "localization",
    title: "Reviewed translations",
    description: "Spanish, Portuguese, German and Japanese pages move from machine-translated drafts to reviewed copy.",
    status: "planned",
    tag: "Site",
  },
  {
    id: "desktop-scene",
    title: "Desktop Scene",
    description: "Lyrics and atmosphere on the desktop, separate from the compact overlay.",
    status: "shipped",
    tag: "Feature",
    version: "2.0",
  },
  {
    id: "stream-window",
    title: "Stream window",
    description: "A capturable window and local browser source for OBS.",
    status: "shipped",
    tag: "Feature",
    version: "2.0",
  },
];

export const roadmapNote =
  "A roadmap is a direction, not a promise of a date. Items can move or disappear when they turn out to be a bad idea. Vote or suggest on Discord.";
