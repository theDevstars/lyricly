#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // A Desktop Scene window lives in Explorer's wallpaper layer, which Chromium
    // treats as occluded: its frame loop drops to about one frame a second and
    // the canvas freezes on whatever it drew first. These are process-wide
    // (one WebView2 environment) because per-window arguments make the second
    // window fail to create its controller.
    #[cfg(windows)]
    {
        // SAFETY: single-threaded, before any window or webview exists.
        unsafe {
            std::env::set_var(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling \
                 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
                 --disable-background-timer-throttling",
            );
        }
    }
    lyrica::run();
}
