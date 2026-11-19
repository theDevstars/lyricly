//! Tray icon and menu. The app has no taskbar button, so this is the only
//! permanent entry point.

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

pub const ITEM_SHOW: &str = "show-lyrics";
pub const ITEM_AMBIENT: &str = "toggle-ambient";
pub const ITEM_WALLPAPER: &str = "toggle-wallpaper";
pub const ITEM_PREFS: &str = "preferences";
pub const ITEM_AUTOSTART: &str = "toggle-autostart";
pub const ITEM_QUIT: &str = "quit";

pub struct TrayState {
    pub ambient: CheckMenuItem<Wry>,
    pub wallpaper: CheckMenuItem<Wry>,
    pub autostart: CheckMenuItem<Wry>,
}

impl TrayState {
    pub fn sync(&self, ambient: bool, wallpaper: bool, autostart: bool) {
        let _ = self.ambient.set_checked(ambient);
        let _ = self.wallpaper.set_checked(wallpaper);
        let _ = self.autostart.set_checked(autostart);
    }
}

pub fn build(app: &AppHandle, ambient: bool, wallpaper: bool, autostart: bool) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, ITEM_SHOW, "Show lyrics", true, None::<&str>)?;
    let ambient_item = CheckMenuItem::with_id(app, ITEM_AMBIENT, "Ambient mode", true, ambient, None::<&str>)?;
    let wallpaper_item =
        CheckMenuItem::with_id(app, ITEM_WALLPAPER, "Wallpaper layer", true, wallpaper, None::<&str>)?;
    let prefs = MenuItem::with_id(app, ITEM_PREFS, "Preferences…", true, None::<&str>)?;
    let autostart_item =
        CheckMenuItem::with_id(app, ITEM_AUTOSTART, "Start with Windows", true, autostart, None::<&str>)?;
    let quit = MenuItem::with_id(app, ITEM_QUIT, "Quit Lyrica", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &ambient_item,
            &wallpaper_item,
            &PredefinedMenuItem::separator(app)?,
            &prefs,
            &autostart_item,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

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
                crate::show_lyrics_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;

    app.manage(TrayState {
        ambient: ambient_item,
        wallpaper: wallpaper_item,
        autostart: autostart_item,
    });

    Ok(())
}
