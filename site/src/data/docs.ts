export type DocTopic = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  bullets: string[];
};

export const docs: DocTopic[] = [
  {
    slug: "settings",
    title: "Settings",
    summary: "Where the app keeps its settings, and how to reset them.",
    body: [
      "Open Lyrica from the tray and choose Settings. Changes apply immediately; there is no Save button. The app writes settings to your local app-data folder, not to an account.",
      "If a setting gets stuck, close Lyrica from the tray, reopen it, and try again. If you need a clean start, export your current style and window position first, then reset the settings file while the app is closed.",
    ],
    bullets: [
      "Start with Windows: adds a Run-key entry for the current user.",
      "Keep display awake: asks Windows to stay awake while lyrics are showing.",
      "Show on desktop: places the overlay behind normal windows instead of above them.",
      "Hide from screen capture: asks Windows to exclude the lyric window from captures.",
    ],
  },
  {
    slug: "styles",
    title: "Styles",
    summary: "Pick, pin and preview a style without restarting playback.",
    body: [
      "The style picker lives in the tray menu and the main window. Hover or focus a style to preview it, then select it to apply it to the current display. Changes are instant.",
      "Each display can have its own style. Set a shared style first, then open the per-display controls and choose an override for the screen you want to differ.",
    ],
    bullets: [
      "Pin a style to keep it near the top of the picker.",
      "Reduced motion replaces animation with a static frame.",
      "Native Design styles keep their own palettes.",
      "The playground on this site uses the same renderers as the app.",
    ],
  },
  {
    slug: "accounts",
    title: "Accounts and keys",
    summary: "What Discord is used for, and where the key lives.",
    body: [
      "The app itself does not need an account. This website uses Discord sign-in to gate the installer and issue one free key per Discord account.",
      "The key is checked offline in the app and stored in Windows Credential Manager. Signing out of the website does not remove the key from your PC. To delete the website record, email support with the key or Discord username.",
    ],
    bullets: [
      "One free key per Discord account.",
      "No password or email is requested from Discord.",
      "The key is personal and non-transferable.",
      "There is no payment during the free beta.",
    ],
  },
  {
    slug: "streaming",
    title: "Streaming",
    summary: "Use the Stream window or a local OBS browser source.",
    body: [
      "Open the Stream window from the tray. It is capturable by design, unlike the everyday overlay, which can be hidden from captures.",
      "For OBS, add a Browser source and use the local Stream URL shown in Settings. Keep the Stream window on the same machine as OBS. The source is local only; it is not a public web page.",
    ],
    bullets: [
      "Use a separate scene for lyrics so you can toggle them.",
      "The Stream window has its own style and palette.",
      "Do not use the overlay's screen-capture exclusion with the Stream window.",
      "Test the source at your stream resolution before going live.",
    ],
  },
  {
    slug: "hotkeys",
    title: "Hotkeys",
    summary: "The default shortcuts and how to change them.",
    body: [
      "Hotkeys are global, so they work while another app has focus. Open Settings and click the shortcut field, then press the combination you want. Use something that does not collide with your player or game.",
      "The default show-and-hide shortcut is Ctrl+Alt+L. Desktop Scene and the Stream window have their own optional shortcuts, both off until you set them.",
    ],
    bullets: [
      "Show or hide lyrics: Ctrl+Alt+L.",
      "Nudge lyrics earlier or later: use the on-screen controls.",
      "Stream window: unset by default.",
    ],
  },
  {
    slug: "command-palette",
    title: "Command palette",
    summary: "Run app actions without leaving the keyboard.",
    body: [
      "Press Ctrl+K while the Lyrica window is focused to open the command palette. Type a few letters of an action, then press Enter.",
      "The palette is a keyboard-first shortcut for actions that also exist in the tray menu. It does not expose any hidden network or account controls.",
    ],
    bullets: [
      "Switch style or display.",
      "Open Settings, the Stream window or the status panel.",
      "Nudge the current song earlier or later.",
      "Reload lyrics for the current track.",
    ],
  },
];

export const shortcutSheet = [
  { keys: "Ctrl + Alt + L", action: "Show or hide the lyric overlay" },
  { keys: "Ctrl + K", action: "Open the command palette" },
  { keys: "Ctrl + Alt + Left", action: "Nudge lyrics 100 ms earlier (where enabled)" },
  { keys: "Ctrl + Alt + Right", action: "Nudge lyrics 100 ms later (where enabled)" },
  { keys: "Ctrl + Alt + S", action: "Open the Stream window (where enabled)" },
  { keys: "Esc", action: "Close the command palette or a dialog" },
];
