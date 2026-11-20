import { describe, expect, it } from "vitest";
import { assessRequirements, detectPlatform } from "./requirements";

describe("platform detection", () => {
  it("detects Windows, macOS, Linux and mobile user agents", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("macos");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
  });

  it("marks non-Windows as unsupported rather than promising a build", () => {
    const result = assessRequirements("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", "Apple M2");
    expect(result.status).toBe("windows-only");
    expect(result.message).toContain("no macOS");
  });

  it("asks Windows users to check graphics when WebGL is unavailable", () => {
    const result = assessRequirements("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", null);
    expect(result.status).toBe("graphics-warning");
    expect(result.webgl).toBeNull();
  });

  it("is ready on Windows with a renderer", () => {
    const result = assessRequirements("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "ANGLE (NVIDIA)");
    expect(result.status).toBe("ready");
    expect(result.webgl).toContain("NVIDIA");
  });
});
