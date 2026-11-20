//! Tray icon and the short mid-song menu. Everything else lives in the Window:
//! the tray only carries quick switches you want without leaving the music.

use tauri::menu::Menu;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;

pub const ITEM_OPEN: &str = "open-window";
pub const ITEM_AWAKE: &str = "toggle-awake";
pub const ITEM_DESKTOP: &str = "toggle-desktop";
pub const ITEM_LATE_NIGHT: &str = "toggle-late-night";
/// "rim:toggle" and "rim:anim:<name>".
pub const ITEM_RIM_PREFIX: &str = "rim:";
pub const ITEM_LICENSE: &str = "license";
pub const ITEM_QUIT: &str = "quit";
pub const ITEM_SIZE_PREFIX: &str = "size:";
pub const ITEM_DISPLAY_PREFIX: &str = "display:";
pub const ITEM_STYLE_PREFIX: &str = "style:";

pub fn build(app: &AppHandle, menu: Menu<tauri::Wry>) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Lyrica")
        .on_menu_event(|app, event| crate::handle_tray_event(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

pub fn sync_menu(app: &AppHandle, menu: Menu<tauri::Wry>) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_menu(Some(menu));
    }
}
