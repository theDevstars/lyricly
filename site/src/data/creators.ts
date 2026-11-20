export type Creator = {
  id: string;
  name: string;
  handle: string;
  url: string;
  specialty: string;
  palette: [string, string, string];
};

/**
 * Featured creators are only added with permission. Keep empty until a real
 * submission has been reviewed and approved.
 */
export const featuredCreators: Creator[] = [];

export const creatorRequirements = [
  "A shareable Lyrica settings code or a palette with three named colours.",
  "No copied artwork, logos, lyrics or another person's preset.",
  "A short description of the mood and the styles it suits.",
  "A credit name and a link you want shown, if any.",
  "Permission for Lyrica to display the preset with credit; removal on request.",
];

export const creatorIdeas = [
  {
    title: "A palette for one song",
    copy: "Pull three colours from a mood, not the cover. Show how it reads in Karaoke Sweep and Neon Sign.",
  },
  {
    title: "A reduced-motion preset",
    copy: "Build a version for people who want the look without the movement. Static frames are welcome.",
  },
  {
    title: "A desk-specific setup",
    copy: "Portrait monitor, ultrawide or a tiny second screen. Explain what you changed and why.",
  },
];

export const creatorSubmissionUrl = "https://discord.gg/AG7bJvtrrK";
