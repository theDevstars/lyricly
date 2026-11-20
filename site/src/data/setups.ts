export type SetupEntry = {
  id: string;
  title: string;
  caption: string;
  style: string;
  player: string;
  screens: 1 | 2 | 3;
  credit: string;
  creditUrl?: string;
  art: [string, string, string];
  featured?: boolean;
  date: string;
  /** Seed entries are generated previews until approved community entries arrive. */
  preview: boolean;
};

export const setups: SetupEntry[] = [
  {
    id: "late-train",
    title: "Late train, one lamp",
    caption: "A single ultrawide, dim lamp and Karaoke Sweep across the bottom third.",
    style: "Karaoke Sweep",
    player: "Spotify",
    screens: 1,
    credit: "Lyrica preview",
    art: ["#170914", "#ff2e88", "#1c1322"],
    featured: true,
    date: "2026-11-20",
    preview: true,
  },
  {
    id: "paper-desk",
    title: "Paper desk",
    caption: "Handwriting on a cream desktop, with the app on a second display.",
    style: "Handwriting",
    player: "Apple Music",
    screens: 2,
    credit: "Lyrica preview",
    art: ["#241f16", "#efe7d2", "#6d5636"],
    date: "2026-11-14",
    preview: true,
  },
  {
    id: "terminal-green",
    title: "Terminal green",
    caption: "Codestyle on a portrait monitor beside a smaller landscape screen.",
    style: "Codestyle",
    player: "Cider",
    screens: 2,
    credit: "Lyrica preview",
    art: ["#06120c", "#3ddc97", "#0b1a12"],
    date: "2026-11-07",
    preview: true,
  },
  {
    id: "night-drive",
    title: "Night drive",
    caption: "Tunnel on the centre screen, with Rim Light carrying the side displays.",
    style: "Tunnel",
    player: "Spotify",
    screens: 3,
    credit: "Lyrica preview",
    art: ["#050a18", "#39d6ff", "#120a20"],
    date: "2026-10-30",
    preview: true,
  },
  {
    id: "quiet-corner",
    title: "Quiet corner",
    caption: "Liquid Type, a small speaker and no other light after sunset.",
    style: "Liquid Type",
    player: "Apple Music",
    screens: 1,
    credit: "Lyrica preview",
    art: ["#04101a", "#2fd8c8", "#13212b"],
    date: "2026-10-22",
    preview: true,
  },
  {
    id: "poster-wall",
    title: "Poster wall",
    caption: "Poster Collage on a wall-mounted display, controlled from a laptop.",
    style: "Poster Collage",
    player: "Spotify",
    screens: 2,
    credit: "Lyrica preview",
    art: ["#1b1408", "#e8e0cd", "#d9482a"],
    date: "2026-10-15",
    preview: true,
  },
];

export const setupStyles = [...new Set(setups.map((setup) => setup.style))].sort();
export const setupPlayers = [...new Set(setups.map((setup) => setup.player))].sort();
export const setupScreens = [1, 2, 3] as const;

export const setupOfTheWeek = setups.find((setup) => setup.featured) ?? setups[0];
export const setupArchive = [...setups].sort((a, b) => b.date.localeCompare(a.date));

export const setupModeration =
  "Only approved entries are listed. Seed entries on this page are generated previews, clearly marked, not submitted community photos. Creators keep their rights and can request removal at any time.";
