export type Announcement = {
  id: string;
  date: string;
  title: string;
  body: string;
  href: string;
  tag: string;
};

export const announcements: Announcement[] = [
  {
    id: "styles-live",
    date: "November 20, 2026",
    title: "New styles are landing in the gallery",
    body: "The style library is growing. Every new renderer gets a live preview, a playground preset and a place in the quiz.",
    href: "/#styles",
    tag: "Styles",
  },
  {
    id: "desktop-scene",
    date: "November 12, 2026",
    title: "Desktop Scene and Rim Light are in 2.0",
    body: "A full desktop lyric layer, ambient edge glow, a player status panel and a stream-safe window.",
    href: "/changelog",
    tag: "Release",
  },
  {
    id: "docs",
    date: "November 20, 2026",
    title: "Setup and troubleshooting docs are open",
    body: "Short guides for Spotify, Apple Music and Cider, plus a decision tree for missing or late lyrics.",
    href: "/docs",
    tag: "Docs",
  },
];
