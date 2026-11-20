//! Offline license keys.
//!
//! A key looks like `LYRICA1.<payload>.<signature>` — URL-safe base64 without
//! padding, where the payload is a small JSON document and the signature is an
//! Ed25519 signature over the payload's ASCII bytes. Only the public half ships
//! in the binary, so activation works offline and no secret is in the app.
//! Keys are issued with `cargo run --example keygen -- sign ...`; they are kept
//! in Windows Credential Manager, never in the settings file.

use crate::credentials;
use crate::settings::Settings;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

/// Public half of the Lyrica signing key, hex. Safe to publish.
pub const PUBLIC_KEY_HEX: &str = "67e84ef1b07bb38eaacc4b2d48c16a5051420423ba9e25d31b848aebbec3164f";

const PREFIX: &str = "LYRICA1";
/// Days of full use before a key is required.
pub const TRIAL_DAYS: i64 = 14;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct License {
    pub v: u8,
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub issued: i64,
    #[serde(default)]
    pub expires: Option<i64>,
    #[serde(default = "default_plan")]
    pub plan: String,
}

fn default_plan() -> String {
    "full".to_string()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LicenseError {
    Malformed(String),
    Signature,
    Expired,
}

impl LicenseError {
    pub fn message(&self) -> String {
        match self {
            Self::Malformed(detail) => detail.clone(),
            Self::Signature => "this key was not issued for Lyrica".into(),
            Self::Expired => "this key has expired".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub enabled: bool,
    /// "active" | "trial" | "expired" | "invalid" | "disabled"
    pub state: String,
    pub name: Option<String>,
    pub plan: Option<String>,
    pub expires_at_ms: Option<i64>,
    pub trial_days_left: Option<i64>,
    pub message: String,
}

impl LicenseStatus {
    fn disabled() -> Self {
        Self {
            enabled: false,
            state: "disabled".into(),
            name: None,
            plan: None,
            expires_at_ms: None,
            trial_days_left: None,
            message: "Licensing is switched off for this build.".into(),
        }
    }
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

/// Verifies a key against the embedded public key.
pub fn verify(key: &str) -> Result<License, LicenseError> {
    let public = public_key()?;
    verify_with(key, &public)
}

pub fn verify_with(key: &str, public: &VerifyingKey) -> Result<License, LicenseError> {
    let trimmed = key.trim();
    let mut parts = trimmed.split('.');
    let (Some(prefix), Some(payload), Some(signature), None) = (
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
    ) else {
        return Err(LicenseError::Malformed(
            "That does not look like a Lyrica key.".into(),
        ));
    };

    if prefix != PREFIX {
        return Err(LicenseError::Malformed(
            "That does not look like a Lyrica key.".into(),
        ));
    }

    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature)
        .map_err(|_| LicenseError::Malformed("The key's signature is unreadable.".into()))?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| LicenseError::Malformed("The key's signature is malformed.".into()))?;

    public
        .verify(payload.as_bytes(), &signature)
        .map_err(|_| LicenseError::Signature)?;

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| LicenseError::Malformed("The key's payload is unreadable.".into()))?;
    let license: License = serde_json::from_slice(&payload_bytes)
        .map_err(|_| LicenseError::Malformed("The key's payload is malformed.".into()))?;

    if license.v != 1 {
        return Err(LicenseError::Malformed(
            "This key uses an unsupported version.".into(),
        ));
    }
    if license.id.trim().is_empty() {
        return Err(LicenseError::Malformed("This key has no id.".into()));
    }
    if let Some(expires) = license.expires {
        if expires.saturating_mul(1000) <= now_ms() {
            return Err(LicenseError::Expired);
        }
    }

    Ok(license)
}

fn public_key() -> Result<VerifyingKey, LicenseError> {
    let bytes = from_hex(PUBLIC_KEY_HEX)
        .ok_or_else(|| LicenseError::Malformed("The embedded public key is unreadable.".into()))?;
    let array: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| LicenseError::Malformed("The embedded public key is wrong length.".into()))?;
    VerifyingKey::from_bytes(&array)
        .map_err(|_| LicenseError::Malformed("The embedded public key is invalid.".into()))
}

fn from_hex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(text.len() / 2);
    let bytes = text.as_bytes();
    for pair in bytes.chunks(2) {
        let high = (pair[0] as char).to_digit(16)?;
        let low = (pair[1] as char).to_digit(16)?;
        out.push((high * 16 + low) as u8);
    }
    Some(out)
}

/// Current license state for the UI and the tray.
pub fn status(settings: &Settings) -> LicenseStatus {
    if !settings.licensing_enabled {
        return LicenseStatus::disabled();
    }

    if let Some(key) = credentials::read(credentials::LICENSE_KEY) {
        match verify(&key) {
            Ok(license) => {
                return LicenseStatus {
                    enabled: true,
                    state: "active".into(),
                    name: (!license.name.is_empty()).then(|| license.name.clone()),
                    plan: Some(license.plan),
                    expires_at_ms: license.expires.map(|seconds| seconds * 1000),
                    trial_days_left: None,
                    message: match license.expires {
                        Some(_) => "Active — this key has an end date.".into(),
                        None => "Active.".into(),
                    },
                };
            }
            Err(LicenseError::Expired) => {
                return LicenseStatus {
                    enabled: true,
                    state: "expired".into(),
                    name: None,
                    plan: None,
                    expires_at_ms: None,
                    trial_days_left: None,
                    message: "This key has run out. Enter a new one to keep Lyrica unlocked.".into(),
                };
            }
            Err(error) => {
                return LicenseStatus {
                    enabled: true,
                    state: "invalid".into(),
                    name: None,
                    plan: None,
                    expires_at_ms: None,
                    trial_days_left: None,
                    message: error.message(),
                };
            }
        }
    }

    let started = if settings.trial_started_ms > 0 {
        settings.trial_started_ms
    } else {
        now_ms()
    };
    let elapsed_days = ((now_ms() - started) / 86_400_000).max(0);
    let left = TRIAL_DAYS - elapsed_days;

    if left > 0 {
        LicenseStatus {
            enabled: true,
            state: "trial".into(),
            name: None,
            plan: Some("trial".into()),
            expires_at_ms: Some(started + TRIAL_DAYS * 86_400_000),
            trial_days_left: Some(left),
            message: format!("Trial — {left} day{} left.", if left == 1 { "" } else { "s" }),
        }
    } else {
        LicenseStatus {
            enabled: true,
            state: "expired".into(),
            name: None,
            plan: Some("trial".into()),
            expires_at_ms: Some(started + TRIAL_DAYS * 86_400_000),
            trial_days_left: Some(0),
            message: "The trial has ended. Enter a key to keep Lyrica unlocked.".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn keypair() -> (SigningKey, VerifyingKey) {
        let signing = SigningKey::from_bytes(&[7u8; 32]);
        let public = signing.verifying_key();
        (signing, public)
    }

    fn issue(signing: &SigningKey, payload: &str) -> String {
        let encoded = URL_SAFE_NO_PAD.encode(payload);
        let signature = signing.sign(encoded.as_bytes());
        format!(
            "{PREFIX}.{encoded}.{}",
            URL_SAFE_NO_PAD.encode(signature.to_bytes())
        )
    }

    const FREE: &str = r#"{"v":1,"id":"ord_1","name":"Invented Person","issued":1700000000,"expires":null,"plan":"full"}"#;

    #[test]
    fn a_signed_key_verifies() {
        let (signing, public) = keypair();
        let key = issue(&signing, FREE);
        let license = verify_with(&key, &public).expect("valid key");
        assert_eq!(license.id, "ord_1");
        assert_eq!(license.name, "Invented Person");
        assert_eq!(license.plan, "full");
    }

    #[test]
    fn a_edited_payload_is_rejected() {
        let (signing, public) = keypair();
        let key = issue(&signing, FREE);
        let parts: Vec<&str> = key.split('.').collect();
        let forged_payload = URL_SAFE_NO_PAD.encode(FREE.replace("ord_1", "ord_9"));
        let forged = format!("{PREFIX}.{forged_payload}.{}", parts[2]);
        assert_eq!(verify_with(&forged, &public).unwrap_err(), LicenseError::Signature);
    }

    #[test]
    fn another_signer_is_rejected() {
        let (_, public) = keypair();
        let other = SigningKey::from_bytes(&[9u8; 32]);
        let key = issue(&other, FREE);
        assert_eq!(verify_with(&key, &public).unwrap_err(), LicenseError::Signature);
    }

    #[test]
    fn expired_keys_are_reported_as_expired() {
        let (signing, public) = keypair();
        let payload = r#"{"v":1,"id":"ord_1","name":"","issued":1700000000,"expires":1700000001,"plan":"full"}"#;
        let key = issue(&signing, payload);
        assert_eq!(verify_with(&key, &public).unwrap_err(), LicenseError::Expired);
    }

    #[test]
    fn junk_is_rejected_without_panicking() {
        let (_, public) = keypair();
        for junk in ["", "hello", "LYRICA1", "LYRICA1.a.b", "LYRICA2.a.b.c", "LYRICA1.!!!!.!!!!"] {
            assert!(verify_with(junk, &public).is_err(), "{junk} should fail");
        }
    }

    #[test]
    fn the_embedded_key_is_configured() {
        assert_ne!(PUBLIC_KEY_HEX, "0".repeat(64), "embed the keygen public key");
        assert!(public_key().is_ok(), "the embedded public key must parse");
    }

    /// Checks a real key against the embedded public key without keeping a
    /// usable licence in the repository:
    /// `LYRICA_TEST_KEY=... cargo test embeds`.
    #[test]
    fn a_key_from_the_keygen_verifies() {
        let Ok(key) = std::env::var("LYRICA_TEST_KEY") else {
            return;
        };
        let licence = verify(&key).expect("keygen output should verify");
        assert!(!licence.id.is_empty());
    }

    #[test]
    fn hex_round_trips() {
        assert_eq!(from_hex("00ff").as_deref(), Some(&[0u8, 255u8][..]));
        assert!(from_hex("0").is_none());
        assert!(from_hex("zz").is_none());
    }
}
