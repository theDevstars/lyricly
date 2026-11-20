export type Support = "yes" | "partial" | "no";

export type PlayerSupport = {
  id: string;
  name: string;
  detail: string;
  liveLyrics: Support;
  queue: Support;
  playbackControls: Support;
  accountLinking: Support;
  remoteDevices: Support;
  footnote?: string;
};

export const players: PlayerSupport[] = [
  {
    id: "spotify",
    name: "Spotify",
    detail: "Desktop app",
    liveLyrics: "yes",
    queue: "partial",
    playbackControls: "yes",
    accountLinking: "partial",
    remoteDevices: "partial",
    footnote:
      "Lyrics come from Lyrica's lyric lookup, not from Spotify. Spotify account linking is optional and only used for playback controls.",
  },
  {
    id: "apple-music",
    name: "Apple Music",
    detail: "Windows app",
    liveLyrics: "yes",
    queue: "no",
    playbackControls: "yes",
    accountLinking: "no",
    remoteDevices: "partial",
    footnote:
      "No queue from the Apple Music app. Lyrica can see the current track and playback state, not the upcoming list.",
  },
  {
    id: "cider",
    name: "Cider",
    detail: "Third-party Apple Music client",
    liveLyrics: "yes",
    queue: "partial",
    playbackControls: "yes",
    accountLinking: "no",
    remoteDevices: "no",
    footnote:
      "Cider support depends on its local API or media-session reporting. Lyrics still come from Lyrica's providers.",
  },
  {
    id: "windows-media",
    name: "Windows media controls",
    detail: "Any player in the media flyout",
    liveLyrics: "partial",
    queue: "no",
    playbackControls: "yes",
    accountLinking: "no",
    remoteDevices: "partial",
    footnote:
      "The flyout does not expose a queue or account identity. Lyrica can follow the track and transport state it reports.",
  },
];

export const playerRows = [
  { key: "liveLyrics" as const, label: "Live lyrics" },
  { key: "queue" as const, label: "Queue" },
  { key: "playbackControls" as const, label: "Playback controls" },
  { key: "accountLinking" as const, label: "Account linking" },
  { key: "remoteDevices" as const, label: "Remote devices" },
];

export const playerNote =
  "Spotify, Apple Music and Cider are trademarks of their owners. Lyrica is not affiliated with, endorsed by or sponsored by them. Support can vary by app version and by what the player exposes to Windows.";
