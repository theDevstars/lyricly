//! Issues Lyrica license keys. The signing key is a secret: it is generated
//! once, kept outside the repository, and never shipped in the app.
//!
//!   cargo run --example keygen -- new
//!       writes license-signing-key.txt (git-ignored) and prints the public key
//!       that belongs in src/license.rs.
//!
//!   cargo run --example keygen -- sign "Invented Person" --days 365
//!       prints a key for that name; --days 0 makes a perpetual key.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const KEY_FILE: &str = "license-signing-key.txt";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("new") => generate(),
        Some("sign") => sign(&args[1..]),
        _ => usage(),
    }
}

fn usage() -> ! {
    eprintln!("usage:\n  keygen new\n  keygen sign \"Name\" [--days 365] [--plan full] [--id ord_1]");
    std::process::exit(2);
}

fn generate() {
    let mut seed = [0u8; 32];
    getrandom::getrandom(&mut seed).expect("randomness");
    let signing = SigningKey::from_bytes(&seed);
    let public = signing.verifying_key();

    std::fs::write(KEY_FILE, hex(&seed)).expect("write signing key");
    println!("wrote {KEY_FILE} (keep it out of the repository)");
    println!("public key: {}", hex(public.as_bytes()));
}

fn sign(args: &[String]) {
    let Some(name) = args.first() else {
        usage();
    };

    let mut days: i64 = 365;
    let mut plan = "full".to_string();
    let mut id = format!(
        "ord_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs())
            .unwrap_or(0)
    );

    let mut index = 1;
    while index < args.len() {
        match args[index].as_str() {
            "--days" => {
                days = args.get(index + 1).and_then(|value| value.parse().ok()).unwrap_or(365);
                index += 2;
            }
            "--plan" => {
                plan = args.get(index + 1).cloned().unwrap_or_else(|| "full".into());
                index += 2;
            }
            "--id" => {
                id = args.get(index + 1).cloned().unwrap_or(id);
                index += 2;
            }
            _ => index += 1,
        }
    }

    let seed_hex = std::fs::read_to_string(Path::new(KEY_FILE))
        .unwrap_or_else(|_| {
            panic!("{KEY_FILE} is missing — run `keygen new` first, or restore your signing key");
        });
    let seed = unhex(seed_hex.trim()).expect("signing key must be hex");
    let signing = SigningKey::from_bytes(&seed[..].try_into().expect("32-byte seed"));

    let issued = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0);
    let expires = (days > 0).then(|| issued + days * 86_400);

    let payload = format!(
        r#"{{"v":1,"id":"{id}","name":"{name}","issued":{issued},"expires":{},"plan":"{plan}"}}"#,
        match expires {
            Some(value) => value.to_string(),
            None => "null".to_string(),
        }
    );

    let encoded = URL_SAFE_NO_PAD.encode(payload.as_bytes());
    let signature = signing.sign(encoded.as_bytes());
    let key = format!(
        "LYRICA1.{encoded}.{}",
        URL_SAFE_NO_PAD.encode(signature.to_bytes())
    );

    println!("{key}");
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    if text.len() % 2 != 0 {
        return None;
    }
    text.as_bytes()
        .chunks(2)
        .map(|pair| {
            let high = (pair[0] as char).to_digit(16)?;
            let low = (pair[1] as char).to_digit(16)?;
            Some((high * 16 + low) as u8)
        })
        .collect()
}
