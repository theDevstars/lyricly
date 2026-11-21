export type Tutorial = {
  id: string;
  title: string;
  duration: string;
  description: string;
  chapters: string[];
  captions: string;
  art: [string, string, string];
  /** Add a privacy-friendly embed URL when the captioned video is published. */
  embedUrl: string;
};

export const tutorials: Tutorial[] = [
  {
    id: "setup-in-a-minute",
    title: "Set up in a minute",
    duration: "1:00",
    description: "Install, open a player, pick a display and choose a style.",
    chapters: ["Install", "Open the player", "Place the overlay", "Pick a style"],
    captions: "English captions are being reviewed. The written setup guide has the same steps.",
    art: ["#160b18", "#ff5c8a", "#2b1730"],
    embedUrl: "",
  },
  {
    id: "desktop-scene",
    title: "Desktop Scene, start to finish",
    duration: "0:50",
    description: "Put lyrics behind your windows without losing the desktop.",
    chapters: ["Choose a display", "Turn on Desktop Scene", "Pick a style", "Hide from capture"],
    captions: "English captions are being reviewed. Desktop Scene is covered in the FAQ.",
    art: ["#120b1e", "#8f7bff", "#24163a"],
    embedUrl: "",
  },
  {
    id: "streaming",
    title: "Add lyrics to OBS",
    duration: "0:55",
    description: "Use the Stream window or a local browser source.",
    chapters: ["Open Stream window", "Copy the local URL", "Add a Browser source", "Test the scene"],
    captions: "English captions are being reviewed. The streaming docs cover both methods.",
    art: ["#08150e", "#3ddc97", "#12291c"],
    embedUrl: "",
  },
];

export const tutorialNote =
  "Videos load only after you press play. Until a captioned video is published, the card opens a short written alternative instead of loading a third-party player.";
