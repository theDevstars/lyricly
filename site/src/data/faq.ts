export type FaqItem = {
  question: string;
  answer: string;
  slug: string;
  category: "Getting started" | "Lyrics" | "Desktop" | "Account" | "Support";
};

export const faqItems: FaqItem[] = [
  {
    slug: "what-does-lyrica-do",
    category: "Getting started",
    question: "What does Lyrica do?",
    answer:
      "Lyrica is a small Windows tray app that puts the lyrics of whatever you are playing on your screen, timed to the song. It reads the now-playing track from Windows' own media controls, so Spotify, Apple Music, Cider, Media Player and most browsers work without any account or integration. Lyrics run in animated styles, from moving type to phone-style screens, and can glow around the edges of your display with Rim Light.",
  },
  {
    slug: "what-are-the-system-requirements",
    category: "Getting started",
    question: "What are the system requirements?",
    answer:
      "Windows 10 version 2004 or newer, or Windows 11. Lyrica uses Microsoft Edge WebView2, which is already present on most PCs; the installer can add it if it is missing. You need a player that appears in Windows media controls. There is no macOS, Linux or mobile build yet.",
  },
  {
    slug: "how-do-i-upgrade",
    category: "Getting started",
    question: "How do updates and upgrades work?",
    answer:
      "Open Lyrica from the tray and choose Check for updates. Updates arrive through the app, not a store. Your settings, style choice and cached lyrics stay in place. If you are on an older build, install the current version over it; the installer keeps your local settings.",
  },
  {
    slug: "why-is-there-no-taskbar-icon",
    category: "Getting started",
    question: "Why is there no taskbar icon?",
    answer:
      "Lyrica is tray-first. Look in the Windows notification area, including the hidden-icons menu, for the Lyrica mark. If you want a taskbar button as well, open Settings and turn on Show in taskbar. If the tray icon is missing entirely, start Lyrica from the Start menu once.",
  },
  {
    slug: "where-do-the-lyrics-come-from",
    category: "Lyrics",
    question: "Where do the lyrics come from?",
    answer:
      "Timed lyrics come from LRCLIB, a free and open lyrics database, and are cached on your PC so repeat plays load instantly. You can optionally add other providers in Settings if you have a key for them. Lyrica does not bundle or host lyrics itself, and it does not send your listening history anywhere.",
  },
  {
    slug: "why-are-lyrics-missing-or-out-of-time",
    category: "Lyrics",
    question: "Why are lyrics missing or out of time?",
    answer:
      "Three things usually cause it: the track has no timed lyrics in the database, the player reported a different title or artist than the database uses, or the file's timing was authored against a different master. Open the status panel from the tray to see which step failed; it tells you if the player is open, whether Lyrica can read the session, and whether timed lyrics were found. If the words are close but early or late, use the nudge control to shift them by a second in either direction. The offset lasts for that song and resets on the next track.",
  },
  {
    slug: "which-songs-have-lyrics",
    category: "Lyrics",
    question: "Which songs have lyrics?",
    answer:
      "Anything with a timed lyric in the provider's catalogue, which covers a large share of released music but not everything. Instrumentals, unreleased tracks, local files and very new releases are the usual gaps. A line-synced lyric can still display even when word-level timing is unavailable. If a song is missing, try another provider or ask in Discord so it can be checked.",
  },
  {
    slug: "does-it-work-with-spotify-apple-music-and-cider",
    category: "Lyrics",
    question: "Does it work with Spotify, Apple Music and Cider?",
    answer:
      "Yes. All three report through the Windows media session, which is what Lyrica reads. The same goes for Windows Media Player, VLC, YouTube in a browser, and anything else that appears in the media flyout. You do not need to sign in to any of them. The Apple Music app does not expose its queue, so Lyrica cannot show what is coming next.",
  },
  {
    slug: "does-it-work-over-games",
    category: "Lyrics",
    question: "Does it work over games?",
    answer:
      "For borderless and windowed games, yes. Lyrica's overlay is click-through and stays above them. Exclusive fullscreen titles bypass the desktop compositor, so the overlay steps aside rather than covering the game or causing a flicker. Switching the game to borderless windowed brings the lyrics back.",
  },
  {
    slug: "how-many-styles-are-there",
    category: "Desktop",
    question: "How many styles are there?",
    answer:
      "The library is growing. Styles are grouped into Kinetic type, Motion scenes, Native Design and Lyric-first. The gallery on the home page always shows the current count, and every style has a live preview and a playground preset. Native Design styles keep their own colours; the others follow your palette.",
  },
  {
    slug: "does-the-screen-stay-awake",
    category: "Desktop",
    question: "Will my screen stay awake?",
    answer:
      "Only if you turn on Keep display awake. It is off by default. The setting asks Windows to keep the display on while lyrics are visible, and it is released when you turn it off or close Lyrica. It does not change your Windows power plan permanently.",
  },
  {
    slug: "can-lyrics-show-on-the-desktop",
    category: "Desktop",
    question: "Can lyrics show on the desktop?",
    answer:
      "Yes. Turn on Show on desktop to place the lyric layer behind normal windows instead of above them, or use Desktop Scene for a full-screen lyric layer. The everyday overlay stays click-through in either case, so it does not get in the way of your icons.",
  },
  {
    slug: "does-it-work-on-external-displays",
    category: "Desktop",
    question: "Does it work on external displays?",
    answer:
      "Yes. Open the display controls and choose which monitor gets the overlay. You can set a different style per display, and Rim Light can follow the same monitor or all displays. If a monitor is unplugged, Lyrica keeps the window position for when it returns.",
  },
  {
    slug: "how-does-hiding-from-screen-capture-work",
    category: "Desktop",
    question: "How does hiding from screen capture work?",
    answer:
      "Windows can exclude a window from capture, so Lyrica asks the system to leave the lyrics window out of recordings and screen shares. Turn on Hide from screen capture and your viewers see the rest of your desktop, not the lyrics. If you would rather stream the lyrics, do the opposite: open the separate Stream window, which is capturable by design and works as an OBS browser source.",
  },
  {
    slug: "does-lyrica-send-my-data-anywhere",
    category: "Account",
    question: "Does Lyrica send my data anywhere?",
    answer:
      "The app has no account and no listening history leaves your PC. Track titles are sent to the lyrics provider only to look up the words, then cached locally. Lyrica checks for updates if you leave update checks on, which sends the app version and nothing else. There is no advertising SDK and no behavioural tracking. The Discord sign-in is only for the download and for claiming a free license key; it stores your Discord user ID, the name on the key and the key itself, not your listening history. The site sets no analytics cookies; the sign-in session cookie is used only for downloads and the account page.",
  },
  {
    slug: "do-i-need-an-account-for-a-license-key",
    category: "Account",
    question: "Do I need an account for a license key?",
    answer:
      "The app itself needs no account. Downloading requires signing in with Discord; the same account can claim one free license key on the account page. One key is issued per Discord account, which keeps automated signups from minting keys in bulk. The key is checked offline in the app and stored in Windows Credential Manager.",
  },
  {
    slug: "can-i-link-spotify-or-apple-music",
    category: "Account",
    question: "Can I link Spotify or Apple Music?",
    answer:
      "Spotify account linking is optional and used only for playback controls. Apple Music and Cider are read through the Windows media session and do not get an account link. You can disconnect Spotify from Settings at any time; the existing lyric features keep working through the media session.",
  },
  {
    slug: "what-is-the-refund-policy",
    category: "Support",
    question: "What is the refund policy?",
    answer:
      "Lyrica is free while in open beta, so there is nothing to refund. If a paid version launches, it will be a one-time purchase with a 14-day refund window, no questions asked. Write to the contact address in the footer with your order details.",
  },
  {
    slug: "how-do-i-uninstall-it",
    category: "Support",
    question: "How do I uninstall it?",
    answer:
      "Open Windows Settings, go to Apps, find Lyrica and choose Uninstall. The uninstaller removes the app, its tray entry and its startup task. Cached lyrics and settings live in your local app data folder and can be deleted by hand if you want them gone. Nothing is left running.",
  },
  {
    slug: "where-can-i-get-help",
    category: "Support",
    question: "Where can I get help or talk to other users?",
    answer:
      "The Lyrica Discord is the fastest place to ask other people using the app, and the setup guide and troubleshooter cover the common failures. For a private question, email support with your Windows version, the player you use and the track that misbehaved. The status panel screenshot helps more than anything.",
  },
];
