export type SetupStep = {
  title: string;
  body: string;
  mock: "install" | "player" | "settings" | "overlay" | "check";
  note?: string;
};

export type SetupTab = {
  id: string;
  label: string;
  blurb: string;
  steps: SetupStep[];
};

export const setupTabs: SetupTab[] = [
  {
    id: "spotify",
    label: "Spotify",
    blurb: "The Windows desktop app. No Spotify account link is needed for lyrics.",
    steps: [
      {
        title: "Install Lyrica",
        body: "Run the installer, then open Lyrica from the Windows tray. Keep the default install location unless you have a reason to change it.",
        mock: "install",
      },
      {
        title: "Open Spotify and play a track",
        body: "Lyrica listens to the Windows media session. Spotify must be playing on this PC; a phone casting to a speaker is not a Windows media session.",
        mock: "player",
      },
      {
        title: "Choose the overlay",
        body: "Open the tray menu and pick a display. The lyric window appears above normal windows and can be dragged where you want it.",
        mock: "overlay",
      },
      {
        title: "Pick a style",
        body: "Open the style picker, preview a few, then select one. Changes apply without restarting the song.",
        mock: "settings",
      },
      {
        title: "Check the status panel",
        body: "If words do not appear, open the status panel. It shows whether the player is open, playing and returning a track, and whether timed lyrics were found.",
        mock: "check",
      },
    ],
  },
  {
    id: "apple-music",
    label: "Apple Music",
    blurb: "The Windows app. Queue information is not exposed to Lyrica.",
    steps: [
      {
        title: "Install and open Lyrica",
        body: "Lyrica lives in the tray. The first-run window offers the main display and a style.",
        mock: "install",
      },
      {
        title: "Start Apple Music on Windows",
        body: "Play a track in the Apple Music desktop app. If it appears in the Windows media flyout, Lyrica can usually see it.",
        mock: "player",
      },
      {
        title: "Choose a display and style",
        body: "Use the tray menu to show the overlay. Set a different style per display if you use more than one screen.",
        mock: "settings",
      },
      {
        title: "Expect no queue",
        body: "The Apple Music app does not expose its upcoming queue to Lyrica. Playback controls and the current track still work.",
        mock: "check",
        note: "No queue from the Apple Music app.",
      },
    ],
  },
  {
    id: "cider",
    label: "Cider",
    blurb: "Cider can report through its local API or the Windows media session.",
    steps: [
      {
        title: "Open Cider and sign in",
        body: "Start Cider and play a track. Keep Cider on the same PC as Lyrica.",
        mock: "player",
      },
      {
        title: "Enable the local API if needed",
        body: "If the Windows media session does not show Cider, open Cider's settings and enable its local API. Lyrica can use the local API when it is available.",
        mock: "settings",
      },
      {
        title: "Check the player status",
        body: "Open Lyrica's status panel. It should name Cider and show whether the API or media session is being used.",
        mock: "check",
      },
      {
        title: "Pick a lyric-first style",
        body: "Cider often supplies word-level timings. Karaoke Sweep and Liquid Type make that timing visible.",
        mock: "overlay",
      },
    ],
  },
];

export const setupChecklist = [
  "The player is open and playing on this PC.",
  "The track appears in Windows media controls.",
  "The status panel names the player and the track.",
  "A timed lyric was found for that title and artist.",
  "The overlay is on the display you expect.",
];
