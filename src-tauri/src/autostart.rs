//! Launch at login, via HKCU\Software\Microsoft\Windows\CurrentVersion\Run.

#![cfg(windows)]

use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "Lyrica";

pub fn set_enabled(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey_with_flags(RUN_KEY, winreg::enums::KEY_WRITE)
        .map_err(|error| error.to_string())?;

    if enabled {
        let exe = std::env::current_exe().map_err(|error| error.to_string())?;
        let command = format!("\"{}\" --tray", exe.display());
        key.set_value(VALUE_NAME, &command)
            .map_err(|error| error.to_string())
    } else {
        match key.delete_value(VALUE_NAME) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }
}
