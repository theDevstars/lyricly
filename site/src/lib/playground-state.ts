export type PlaygroundState = {
  style: string;
  size: number;
  font: string;
  text: string;
  highlight: string;
  secondary: string;
  autoSync: boolean;
  cover: string;
  backdrop: "black" | "blur" | "gradient";
  glow: boolean;
  glowColor: string;
  thickness: number;
  position: number;
};

export const PLAYGROUND_FONTS = [
  { id: "inter-tight", label: "Inter Tight", stack: '"Inter Tight", Inter, sans-serif' },
  { id: "inter", label: "Inter", stack: '"Inter", system-ui, sans-serif' },
  { id: "mono", label: "System mono", stack: '"Cascadia Mono", Consolas, monospace' },
] as const;

export const DEFAULT_PLAYGROUND: PlaygroundState = {
  style: "ship",
  size: 1,
  font: "inter-tight",
  text: "#ffffff",
  highlight: "#ff5c8a",
  secondary: "#b9b9c2",
  autoSync: true,
  cover: "lanterns",
  backdrop: "black",
  glow: true,
  glowColor: "#ff5c8a",
  thickness: 22,
  position: 1800,
};

const hex = (value: string | null, fallback: string) =>
  value && /^#?[0-9a-f]{6}$/i.test(value) ? `#${value.replace("#", "")}` : fallback;

export function decodePlaygroundState(search: string): PlaygroundState {
  const params = new URLSearchParams(search);
  const backdrop = params.get("backdrop");
  const font = params.get("font");
  const position = Number(params.get("t"));
  const size = Number(params.get("size"));
  const thickness = Number(params.get("thickness"));

  return {
    style: params.get("style") || DEFAULT_PLAYGROUND.style,
    size: Number.isFinite(size) ? Math.min(1.6, Math.max(0.75, size)) : DEFAULT_PLAYGROUND.size,
    font: PLAYGROUND_FONTS.some((entry) => entry.id === font) ? font! : DEFAULT_PLAYGROUND.font,
    text: hex(params.get("text"), DEFAULT_PLAYGROUND.text),
    highlight: hex(params.get("highlight"), DEFAULT_PLAYGROUND.highlight),
    secondary: hex(params.get("secondary"), DEFAULT_PLAYGROUND.secondary),
    autoSync: params.get("auto") !== "0",
    cover: params.get("cover") || DEFAULT_PLAYGROUND.cover,
    backdrop:
      backdrop === "blur" || backdrop === "gradient" ? backdrop : DEFAULT_PLAYGROUND.backdrop,
    glow: params.get("glow") !== "0",
    glowColor: hex(params.get("glowColor"), DEFAULT_PLAYGROUND.glowColor),
    thickness: Number.isFinite(thickness)
      ? Math.min(48, Math.max(0, thickness))
      : DEFAULT_PLAYGROUND.thickness,
    position: Number.isFinite(position)
      ? Math.min(60_000, Math.max(0, position))
      : DEFAULT_PLAYGROUND.position,
  };
}

export function encodePlaygroundState(state: PlaygroundState): string {
  const params = new URLSearchParams();
  params.set("style", state.style);
  params.set("size", state.size.toFixed(2));
  params.set("font", state.font);
  params.set("text", state.text.replace("#", ""));
  params.set("highlight", state.highlight.replace("#", ""));
  params.set("secondary", state.secondary.replace("#", ""));
  params.set("auto", state.autoSync ? "1" : "0");
  params.set("cover", state.cover);
  params.set("backdrop", state.backdrop);
  params.set("glow", state.glow ? "1" : "0");
  params.set("glowColor", state.glowColor.replace("#", ""));
  params.set("thickness", String(Math.round(state.thickness)));
  params.set("t", String(Math.round(state.position)));
  return params.toString();
}
