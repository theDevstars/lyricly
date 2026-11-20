/** Invented song and invented lyrics — no real titles, artists or words. */
export const demoTrack = {
  title: "Paper Satellites",
  artist: "Nova Vale",
  album: "Night Signals",
  artwork: "PS",
  accent: "#ff5c8a",
};

export const demoLines = [
  "We drove past the harbour",
  "with the windows down",
  "every light a promise",
  "every turn a sound",
];

export const secondTrack = {
  title: "Afterglow",
  artist: "Juniper Row",
  album: "Slow Static",
  artwork: "JR",
};

export const sceneNames = ["Messages", "Map", "Codestyle", "Constellation"] as const;
export type SceneName = (typeof sceneNames)[number];
