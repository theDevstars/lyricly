export type Platform = "windows" | "macos" | "linux" | "mobile" | "unknown";
export type RequirementStatus = "ready" | "windows-only" | "graphics-warning";

export type RequirementResult = {
  platform: Platform;
  status: RequirementStatus;
  title: string;
  message: string;
  webgl: string | null;
};

export function detectPlatform(userAgent: string): Platform {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return "mobile";
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  if (/Linux|X11/i.test(userAgent)) return "linux";
  return "unknown";
}

export function assessRequirements(
  userAgent: string,
  webglRenderer: string | null,
): RequirementResult {
  const platform = detectPlatform(userAgent);
  if (platform !== "windows") {
    return {
      platform,
      status: "windows-only",
      title: "Windows only for now",
      message:
        "Lyrica is a Windows tray app. There is no macOS, Linux or mobile build yet. Leave an email and we will write once, when one exists.",
      webgl: webglRenderer,
    };
  }

  if (!webglRenderer) {
    return {
      platform,
      status: "graphics-warning",
      title: "Windows detected, graphics info unavailable",
      message:
        "You are on Windows. The browser could not read a WebGL renderer, which can happen with hardware acceleration off. The app needs Windows 10 2004 or newer and WebView2; check both before installing.",
      webgl: null,
    };
  }

  return {
    platform,
    status: "ready",
    title: "You're good to go",
    message:
      "Windows detected and the browser has a working graphics renderer. Lyrica also needs Windows 10 2004 or newer and the WebView2 runtime, which is already present on most PCs.",
    webgl: webglRenderer,
  };
}

export function readWebglRenderer(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl" as "webgl");
    if (!gl) return null;
    const context = gl as WebGLRenderingContext;
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    if (!extension) return "WebGL available";
    return String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL) || "WebGL available");
  } catch {
    return null;
  }
}
