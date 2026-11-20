import { describe, expect, it } from "vitest";
import { everyAnswerPathReturnsThree, rankStyles } from "./quiz";

describe("style quiz", () => {
  it("returns three distinct styles for a complete answer set", () => {
    const result = rankStyles(["quiet", "minimal", "one", "still", "calm"]);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((entry) => entry.style.slug)).size).toBe(3);
  });

  it("is deterministic for the same answers", () => {
    const first = rankStyles(["loud", "rgb", "three", "wild", "energetic"]);
    const second = rankStyles(["loud", "rgb", "three", "wild", "energetic"]);
    expect(first.map((entry) => entry.style.slug)).toEqual(second.map((entry) => entry.style.slug));
  });

  it("returns three styles for every possible answer path", () => {
    expect(everyAnswerPathReturnsThree()).toBe(true);
  });
});
