import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND,
  decodePlaygroundState,
  encodePlaygroundState,
} from "./playground-state";

describe("playground URL state", () => {
  it("round-trips a configured state", () => {
    const state = {
      ...DEFAULT_PLAYGROUND,
      style: "tunnel",
      size: 1.2,
      font: "mono",
      text: "#ffeedd",
      autoSync: false,
      backdrop: "blur" as const,
      position: 4200,
    };
    expect(decodePlaygroundState(`?${encodePlaygroundState(state)}`)).toEqual(state);
  });

  it("clamps size and position to safe values", () => {
    const state = decodePlaygroundState("?size=9&t=999999");
    expect(state.size).toBe(1.6);
    expect(state.position).toBe(60_000);
  });

  it("rejects invalid hex colours", () => {
    const state = decodePlaygroundState("?text=red&highlight=%23GGGGGG");
    expect(state.text).toBe(DEFAULT_PLAYGROUND.text);
    expect(state.highlight).toBe(DEFAULT_PLAYGROUND.highlight);
  });

  it("falls back for unknown fonts and backdrops", () => {
    const state = decodePlaygroundState("?font=comic-sans&backdrop=video");
    expect(state.font).toBe(DEFAULT_PLAYGROUND.font);
    expect(state.backdrop).toBe(DEFAULT_PLAYGROUND.backdrop);
  });
});
