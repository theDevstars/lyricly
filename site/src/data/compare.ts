export type CompareValue = "yes" | "partial" | "no";

export type CompareColumn = {
  id: string;
  label: string;
  detail: string;
  highlight?: boolean;
};

export type CompareRow = {
  feature: string;
  detail: string;
  values: Record<string, CompareValue>;
  note?: string;
};

export const compareColumns: CompareColumn[] = [
  { id: "lyrica", label: "Lyrica", detail: "This app", highlight: true },
  { id: "flyout", label: "Windows media flyout", detail: "The built-in control", highlight: false },
  { id: "widgets", label: "Desktop widget skins", detail: "General desktop widgets", highlight: false },
  { id: "others", label: "Other lyric apps", detail: "Category-level summary", highlight: false },
];

export const compareRows: CompareRow[] = [
  {
    feature: "Sources supported",
    detail: "Which players can feed the display",
    values: { lyrica: "yes", flyout: "partial", widgets: "partial", others: "partial" },
    note: "Lyrica reads any player that reports to Windows media controls, including Spotify, Apple Music and Cider.",
  },
  {
    feature: "Word-level timing",
    detail: "Highlights the exact word being sung",
    values: { lyrica: "yes", flyout: "no", widgets: "no", others: "partial" },
    note: "Some lyric apps show line-synced lyrics only. It depends on the provider and the track.",
  },
  {
    feature: "Style range",
    detail: "Number of distinct visual treatments",
    values: { lyrica: "yes", flyout: "no", widgets: "partial", others: "partial" },
    note: "Lyrica's style count is shown on the home page and updates with the app's renderer registry.",
  },
  {
    feature: "Multi-monitor",
    detail: "Separate overlay placement or style per display",
    values: { lyrica: "yes", flyout: "no", widgets: "partial", others: "partial" },
  },
  {
    feature: "Edge lighting",
    detail: "Ambient glow around the display edge",
    values: { lyrica: "yes", flyout: "no", widgets: "partial", others: "partial" },
    note: "Rim Light is built into Lyrica; other tools may rely on separate lighting software.",
  },
  {
    feature: "Ambient screen",
    detail: "A full-screen lyric mode for an idle display",
    values: { lyrica: "yes", flyout: "no", widgets: "no", others: "partial" },
  },
  {
    feature: "Streaming tools",
    detail: "OBS browser source or a capturable window",
    values: { lyrica: "yes", flyout: "no", widgets: "no", others: "partial" },
    note: "Lyrica has a Stream window and a local browser source. Other apps vary.",
  },
  {
    feature: "Price",
    detail: "What you pay to use it",
    values: { lyrica: "yes", flyout: "yes", widgets: "partial", others: "partial" },
    note: "Lyrica is free while in open beta. Built-in Windows controls are free. Other products vary.",
  },
];

export const compareUpdated = "November 20, 2026";
export const compareNote =
  "This table is a category-level summary gathered from public product information. It is not a benchmark. Products change, and a missing feature may still be possible through another tool. Corrections are welcome by email.";
