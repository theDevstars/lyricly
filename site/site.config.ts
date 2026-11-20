/**
 * Everything you are likely to change lives here.
 * Rebuild after editing: `npm run build`.
 */
export type NavLink = { label: string; href: string; external?: boolean };

const DISCORD_INVITE = "https://discord.gg/AG7bJvtrrK";

const siteConfig = {
  name: "Lyrica",
  wordmark: "Lyrica",
  tagline: "Time-synced lyrics for your Windows desktop.",
  description:
    "Lyrica is a Windows tray app that shows time-synced lyrics from Spotify, Apple Music and Cider in animated styles, with ambient Rim Light. Free; a Discord account is required to download.",

  /** Canonical origin. Also used for the sitemap, RSS and social cards. */
  url: "https://lyrica-avh2b6.freebuff.site",
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
    priceNote:
      "Free while Lyrica is in open beta. A Discord account is required to download; there is no payment.",
    ctaLabel: "Download for Windows",
    badge: "Free · 3.5 MB",
    /** Optional line under the button, e.g. "One-time purchase. Updates included." */
    footnote: "Includes updates through the app. Windows 10 2004+ or Windows 11.",
  },

  download: {
    /**
     * Served directly from the site. The installer lives at
     * site/public/downloads/Lyrica-Setup-2.0.0.exe, so clicking downloads it
     * instead of sending people to an external page.
     */
    windowsUrl: "/downloads/Lyrica-Setup-2.0.0.exe",
    /** SHA-256 of that exact file. Regenerate whenever you replace the installer. */
    sha256: "ce16b1efaa33f9dfc8570cd45053033d465bb3cfd944d96aeeac80b644dd9d7e",
    sizeLabel: "3.5 MB",
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
    { label: "Account", href: "/account" },
    { label: "FAQ", href: "/faq" },
  ] satisfies NavLink[],

  footerLinks: [
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Account", href: "/account" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact", href: "mailto:hello@lyrica.app" },
    { label: "Join Discord", href: DISCORD_INVITE, external: true },
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

  discord: {
    /** Non-expiring invite to the public #verify channel. */
    inviteUrl: DISCORD_INVITE,
  },

  legal: {
    updated: "November 20, 2026",
    entity: "Lyrica",
    contactEmail: "hello@lyrica.app",
  },
};

export default siteConfig;
export type SiteConfig = typeof siteConfig;
