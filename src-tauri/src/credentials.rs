//! Windows Credential Manager: API tokens live here, never in the plain-text
//! settings file and never in a log.

#![allow(dead_code)] // the preferences UI writes these in a later step

/// Credential target used for the Genius API token.
pub const GENIUS_TOKEN: &str = "lyrica/genius-token";
/// Credential target used for the Musixmatch API key.
pub const MUSIXMATCH_KEY: &str = "lyrica/musixmatch-key";
/// Credential target used for the Cider API token.
pub const CIDER_TOKEN: &str = "lyrica/cider-token";
/// Credential target holding the signed license key.
pub const LICENSE_KEY: &str = "lyrica/license-key";
/// Spotify OAuth tokens (access and refresh) for the linked account.
pub const SPOTIFY_ACCESS: &str = "lyrica/spotify-access";
pub const SPOTIFY_REFRESH: &str = "lyrica/spotify-refresh";

pub fn read(name: &str) -> Option<String> {
    imp::read(name)
}

pub fn write(name: &str, value: &str) -> Result<(), String> {
    imp::write(name, value)
}

pub fn delete(name: &str) -> Result<(), String> {
    imp::delete(name)
}

#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use std::ptr::null_mut;

    #[repr(C)]
    struct CredentialW {
        flags: u32,
        type_: u32,
        target_name: *mut u16,
        comment: *mut u16,
        last_written: u64,
        credential_blob_size: u32,
        credential_blob: *mut u8,
        persist: u32,
        attribute_count: u32,
        attributes: *mut c_void,
    }

    #[link(name = "advapi32")]
    extern "system" {
        fn CredReadW(
            target: *const u16,
            kind: u32,
            flags: u32,
            credential: *mut *mut CredentialW,
        ) -> i32;
        fn CredWriteW(credential: *const CredentialW, flags: u32) -> i32;
        fn CredDeleteW(target: *const u16, kind: u32, flags: u32) -> i32;
        fn CredFree(buffer: *mut c_void);
    }

    const CRED_TYPE_GENERIC: u32 = 1;
    const CRED_PERSIST_LOCAL_MACHINE: u32 = 2;

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn read(name: &str) -> Option<String> {
        let target = wide(name);
        let mut credential: *mut CredentialW = null_mut();
        let ok = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut credential) };
        if ok == 0 || credential.is_null() {
            return None;
        }

        let text = unsafe {
            let entry = &*credential;
            let value = if entry.credential_blob.is_null() || entry.credential_blob_size == 0 {
                String::new()
            } else {
                let bytes = std::slice::from_raw_parts(
                    entry.credential_blob,
                    entry.credential_blob_size as usize,
                );
                String::from_utf8_lossy(bytes)
                    .trim_end_matches('\0')
                    .to_string()
            };
            CredFree(credential as *mut c_void);
            value
        };

        (!text.is_empty()).then_some(text)
    }

    pub fn write(name: &str, value: &str) -> Result<(), String> {
        let mut target = wide(name);
        let mut blob = value.as_bytes().to_vec();
        let credential = CredentialW {
            flags: 0,
            type_: CRED_TYPE_GENERIC,
            target_name: target.as_mut_ptr(),
            comment: null_mut(),
            last_written: 0,
            credential_blob_size: blob.len() as u32,
            credential_blob: blob.as_mut_ptr(),
            persist: CRED_PERSIST_LOCAL_MACHINE,
            attribute_count: 0,
            attributes: null_mut(),
        };

        let ok = unsafe { CredWriteW(&credential, 0) };
        if ok == 0 {
            Err(std::io::Error::last_os_error().to_string())
        } else {
            Ok(())
        }
    }

    pub fn delete(name: &str) -> Result<(), String> {
        let target = wide(name);
        let ok = unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) };
        if ok == 0 {
            Err(std::io::Error::last_os_error().to_string())
        } else {
            Ok(())
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn read(_name: &str) -> Option<String> {
        None
    }

    pub fn write(_name: &str, _value: &str) -> Result<(), String> {
        Err("the credential store is only available on Windows".into())
    }

    pub fn delete(_name: &str) -> Result<(), String> {
        Err("the credential store is only available on Windows".into())
    }
}
