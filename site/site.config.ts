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
    "Lyrica is a Windows tray app that shows time-synced lyrics from Spotify, Apple Music and Cider in animated styles, one per display. Free; a Discord account is required to download.",

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
    /** "free" keeps the open-beta offer; "paid" reveals the one-time card. */
    mode: "free" as "free" | "paid",
    priceLabel: "Free",
    priceNote:
      "Free while Lyrica is in open beta. A Discord account is required to download; there is no payment.",
    ctaLabel: "Download for Windows",
    badge: "Free · 3.8 MB",
    /** Optional line under the button, e.g. "One-time purchase. Updates included." */
    footnote: "Includes updates through the app. Windows 10 2004+ or Windows 11.",
    oneTime: {
      amount: "$0",
      note: "No payment is taken while the beta is free.",
      updates: "All 2.x updates",
      seats: "2 PCs",
    },
    includes: [
      "Every current and future style",
      "Desktop Scene and Stream window",
      "Updates delivered through the app",
      "No subscription and no in-app ads",
    ],
    refund:
      "Free while in open beta, so there is nothing to refund. If a paid version launches, it will be a one-time purchase with a 14-day refund window.",
    gift: {
      enabled: false,
      label: "Give a license",
      url: "",
      note: "Gift checkout is not open during the free beta.",
    },
    sale: {
      enabled: false,
      label: "Launch offer",
      endsAt: "",
      note: "",
      href: "#download",
    },
    trial: {
      /** The current build is free, not a timed trial. */
      enabled: false,
      days: 14,
      text: "Try free for {days} days. No account needed.",
    },
  },

  download: {
    /**
     * Served directly from the site. The installer lives at
     * site/public/downloads/Lyrica-Setup-2.0.0.exe, so clicking downloads it
     * instead of sending people to an external page.
     */
    windowsUrl: "/downloads/Lyrica-Setup-2.0.0.exe",
    fileName: "Lyrica-Setup-2.0.0.exe",
    /** SHA-256 of that exact file. Regenerate whenever you replace the installer. */
    sha256: "cb2e64e7ecf853ab21c3858b1ea825265faa1eb2e56daa0a6898451478c225e5",
    sizeLabel: "3.8 MB",
    /** Add a real public report before showing the link. */
    virusTotalUrl: "",
    /** Only set true when the shipped installer is actually code-signed. */
    signed: false,
    signatureNote: "This build is not code-signed. Windows may show a SmartScreen prompt.",
    verifyHelp:
      'PowerShell: Get-FileHash ".\\Lyrica-Setup-2.0.0.exe" -Algorithm SHA256',
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
    text: "New styles, player status and Desktop Scene.",
    href: "/changelog",
    cta: "See what changed",
  },

  nav: [
    { label: "Styles", href: "/#styles" },
    { label: "Playground", href: "/playground" },
    { label: "Compare", href: "/compare" },
    { label: "Setup", href: "/setup" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
  ] satisfies NavLink[],

  footerLinks: [
    { label: "Blog", href: "/blog" },
    { label: "Changelog", href: "/changelog" },
    { label: "Roadmap", href: "/roadmap" },
    { label: "FAQ", href: "/faq" },
    { label: "Playground", href: "/playground" },
    { label: "Style quiz", href: "/quiz" },
    { label: "Compare", href: "/compare" },
    { label: "Setups", href: "/setups" },
    { label: "Setup guide", href: "/setup" },
    { label: "Troubleshoot", href: "/troubleshoot" },
    { label: "Docs", href: "/docs" },
    { label: "Creators", href: "/creators" },
    { label: "Referrals", href: "/referrals" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact", href: "mailto:hello@lyrica.app" },
    { label: "Join Discord", href: DISCORD_INVITE, external: true },
  ] satisfies NavLink[],

  footerGroups: [
    {
      title: "Product",
      links: [
        { label: "Styles", href: "/#styles" },
        { label: "Playground", href: "/playground" },
        { label: "Style quiz", href: "/quiz" },
        { label: "Compare", href: "/compare" },
        { label: "Setups", href: "/setups" },
      ],
    },
    {
      title: "Learn",
      links: [
        { label: "Setup guide", href: "/setup" },
        { label: "Troubleshoot", href: "/troubleshoot" },
        { label: "Docs", href: "/docs" },
        { label: "Tutorials", href: "/tutorials" },
        { label: "Requirements", href: "/requirements" },
      ],
    },
    {
      title: "About",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "Changelog", href: "/changelog" },
        { label: "Roadmap", href: "/roadmap" },
        { label: "Creators", href: "/creators" },
        { label: "Referrals", href: "/referrals" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Contact", href: "mailto:hello@lyrica.app" },
      ],
    },
  ] satisfies { title: string; links: NavLink[] }[],

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
    guildId: "1573169716480970872",
    /** The widget only appears if the server enables its public widget. */
    widgetEnabled: true,
    joinLabel: "Join the Discord",
    submitSetupUrl: DISCORD_INVITE,
    creatorSubmitUrl: DISCORD_INVITE,
    announcementsUrl: DISCORD_INVITE,
  },

  newsletter: {
    enabled: true,
    /** Provider hosted form endpoint. Empty opens a pre-addressed email. */
    formUrl: "",
    email: "hello@lyrica.app",
    consent:
      "One short update a month. Unsubscribe in one click. We store only your email and consent time.",
    doubleOptIn: true,
    privacyUrl: "/privacy",
  },

  referrals: {
    enabled: false,
    reward: "One free month of updates for every friend who installs.",
    url: "",
    note: "The referral programme opens after the paid release. Checkout will be hosted by the payment provider; card details never touch this site.",
  },

  community: {
    setupsSubmitUrl: DISCORD_INVITE,
    creatorsSubmitUrl: DISCORD_INVITE,
    moderationNote:
      "Only approved entries are listed. Credits stay with their creators, and removal is available on request.",
  },

  status: {
    /** A lyric lookup service is not run by this site, so the page stays hidden. */
    enabled: false,
    href: "/status",
    label: "Status",
  },

  features: {
    reviews: true,
    newsletter: true,
    referrals: false,
    discordWidget: true,
    tutorials: true,
    statusPage: false,
  },

  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English", dir: "ltr" },
      { code: "es", label: "Español", dir: "ltr" },
      { code: "pt", label: "Português", dir: "ltr" },
      { code: "de", label: "Deutsch", dir: "ltr" },
      { code: "ja", label: "日本語", dir: "ltr" },
    ],
    machineTranslated: ["es", "pt", "de", "ja"],
  },

  legal: {
    updated: "November 20, 2026",
    entity: "Lyrica",
    contactEmail: "hello@lyrica.app",
    submissionRules:
      "By submitting a setup, palette or style preset you confirm you own or have permission to share it, you keep your rights, and you grant Lyrica permission to display it with credit. You can request removal at any time.",
  },
};

export default siteConfig;
export type SiteConfig = typeof siteConfig;
