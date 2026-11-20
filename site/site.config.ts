/**
 * Everything you are likely to change lives here.
 * Rebuild after editing: `npm run build`.
 */
export type NavLink = { label: string; href: string };

const siteConfig = {
  name: "Lyrica",
  wordmark: "Lyrica",
  tagline: "Time-synced lyrics for your Windows desktop.",
  description:
    "Lyrica is a Windows tray app that shows time-synced lyrics from Spotify, Apple Music and Cider in animated styles, with ambient Rim Light. Free, no account.",

  /** Canonical origin. Also used for the sitemap, RSS and social cards. */
  url: "https://lyrica.app",
  /** One accent, used for eyebrows, badges, step numbers and focus rings. */
  accent: "#FF5C8A",

  product: {
    version: "2.0.0",
    releaseDate: "2026-11-12",
    /** "free" or "paid". Paid shows the price from pricing.priceLabel. */
    kind: "free" as "free" | "paid",
  },

  pricing: {
    priceLabel: "Free",
    priceNote: "Free while Lyrica is in open beta. No account, no subscription.",
    ctaLabel: "Download for Windows",
    badge: "Free · 18.4 MB",
    /** Optional line under the button, e.g. "One-time purchase. Updates included." */
    footnote: "Includes updates through the app. Windows 10 2004+ or Windows 11.",
  },

  download: {
    /** Replace with your signed installer URL. */
    windowsUrl: "https://github.com/lyrica-app/lyrica/releases/latest/download/Lyrica-Setup-2.0.0.exe",
    /** Shown under the download button. Replace when you ship a new installer. */
    sha256: "9f2c41d7e0b6a85c3d14f9b27e6c0a8d5f31b7e94c2a6d80f5b3e1c97a4d6208",
    sizeLabel: "18.4 MB",
  },

  systemRequirements: [
    "Windows 10 version 2004 or newer, or Windows 11",
    "Microsoft Edge WebView2 runtime (already present on most PCs)",
    "Any player that appears in Windows' media controls",
  ],

  /** The dismissible strip above the top bar. Set enabled: false to remove it. */
  announcement: {
    enabled: true,
    label: "New in 2.0",
    text: "Four Native Design styles, player status, and Rim Light.",
    href: "/changelog",
    cta: "See what changed",
  },

  nav: [
    { label: "Styles", href: "/#styles" },
    { label: "Rim Light", href: "/#rim-light" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
  ] satisfies NavLink[],

  footerLinks: [
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "mailto:hello@lyrica.app" },
  ] satisfies NavLink[],

  /** Optional, cookie-free analytics. Leave empty to ship no analytics at all. */
  analytics: {
    plausibleDomain: "",
  },

  /** Where the "Windows only for now" email form sends people. */
  updates: {
    email: "hello@lyrica.app",
    /** Optional form endpoint (e.g. a Buttondown/Basin URL). Empty opens a mail draft instead. */
    formUrl: "",
  },

  social: {
    ogImage: "/og.png",
    twitterHandle: "",
  },

  legal: {
    updated: "November 12, 2026",
    entity: "Lyrica",
    contactEmail: "hello@lyrica.app",
  },
};

export default siteConfig;
export type SiteConfig = typeof siteConfig;
