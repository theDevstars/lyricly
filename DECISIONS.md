# VerseGlow — decisions and assumptions

These are the initial Step 1 defaults. Revisit when implementation evidence requires it; record any change here instead of silently deviating from product requirements.

## Product identity

- **App name:** VerseGlow. The initial desktop shell defines one `APP_NAME` constant for visible app branding. Before adding native configuration, derive window titles, deep links, tray labels and user-facing references from the same canonical value; package metadata currently uses the corresponding lowercase package slug.
- Original identity only: no Apple, Spotify or Cider logos, protected fonts/branding or implied endorsement. Service names may be used descriptively with attribution as required.
- Demo music and lyrics remain invented; runtime artwork is ephemeral in-memory by default; never bundle real lyrics, album art or third-party map tiles.

## Technical defaults

- Tauri 2 + Rust + TypeScript/React + pnpm workspaces as specified. Treat Windows 10/11 as the production target; keep pure logic portable for tests.
- Rust is the authority for OS/player integrations and secrets. One broadcasted `LyricState` feeds all views, with a current-state snapshot available to windows that subscribe after creation.
- Use TypeScript pure packages for shared lyric state/timing/style contracts; Rust SMTC and service integrations adapt into typed events. Avoid a second independent renderer playhead.
- Start with JSON settings in app data and explicit schema version/migrations/rollback; use SQLite for lyric/provider cache where justified. Secrets are stored in Windows Credential Manager only.
- Start with one usable vertical slice and scale toward the broad specification milestone by milestone. A listed capability is not considered implemented until its tests and stated platform checks pass.

## Player and service behavior

- **Default now-playing path:** Windows SMTC, no account or permission prompt, with source status explaining session availability.
- **Cider:** use current documented RPC REST as baseline, default local port `10767`; ask for/accept a local API token stored only in Credential Manager. Do not assume an undocumented WebSocket/socket.io schema. Add socket/push support only after validating authoritative docs and compatibility with current Cider releases. Legacy port `9000` is not the default.
- **Spotify:** optional user-initiated Authorization Code + PKCE in system browser, loopback IP redirect and verified random `state`. Begin with read-only playback/currently-playing scopes. Request write scopes only after explicit controls opt-in. Provide a clear development-mode allowlist/Premium limitation and graceful handling of 204/401/403/429. Keep SMTC functional without linking.
- **Apple Music:** optional MusicKit web bridge for account/catalog/library features; no claim that it provides live now-playing for the standalone Windows Apple Music app. Use a separately deployed short-lived ES256 token signer; signing private key is a host secret and never enters the repository/client. A user Music Token belongs in Credential Manager if the chosen supported flow exposes it to the native app; otherwise let MusicKit manage it in WebView and avoid copying tokens unnecessarily.
- **Source arbitration:** pinned source wins; otherwise linked Spotify playing wins only on a confident same-track match; unmatched recent activity wins with hysteresis. Remote-device playback must be labeled and must not claim local loopback audio is available.

## Lyrics, privacy and network

- LRCLIB is the initial online lyrics provider, accessed from Rust; cache locally with attribution, match confidence and an explicit mismatch path. User overrides take priority.
- No default Genius scraping, automatic translation, microphone capture, network listener, telemetry, or cloud data collection. Optional features stay off until the user enables them and see an appropriate disclosure.
- Network calls are limited to enabled lyric/provider/account/update/weather/optional-feature needs; diagnostic export strips tokens and minimizes track/personal details.
- Observe each provider's terms, quotas, attributions and caching/display restrictions. Do not equate technical availability with permission to redistribute lyrics.

## Platform limitations and alternatives

- Windows lock screen is not a third-party drawing surface. Ambient is a regular borderless topmost monitor window and must say this clearly; it cannot replace the real lock screen or draw over the secure desktop.
- Desktop Scene WorkerW attachment and exclusive-fullscreen detection are best-effort Windows behaviors. Always provide a non-WorkerW fallback and panic-hide control; never promise attachment over every shell/GPU configuration before release testing.
- MusicKit's user authorization/library features are distinct from live playback observation. SMTC/Cider remains the source for external Apple Music playback.
- The user-specified folder path `C:\Users\chasi\Downloads\vids` was given without an explicit action. It is not part of project scope; do not inspect or modify it unless separately requested.

## Visual direction

- The user clarified that the product should feel **like a wallpaper**. The desktop shell therefore uses a full-bleed atmospheric scene, subtle original color fields/grain, lyrics as the centerpiece, and a compact translucent transport dock. Settings and navigation should remain secondary to the immersive scene.
- User-supplied screenshots/videos are references for UI behavior and bugs; do not bundle or redistribute them. Create original interface/art rather than copying supplied imagery.

## Verification status

- Cider RPC docs, Spotify auth/scopes/quota docs, and Apple Music developer-token/user-authentication docs were reviewed for the plan on 2026-11-21. API details should be checked again immediately before implementing each integration because provider docs and policies can change.
- Foundation slice implemented: npm workspace, shared lyric model/timing and LRC parser, phrase splitter, invented DemoPlayer data, Constellation renderer, and wallpaper-style React preview shell.
- Verified: `npm run build --workspace @verseglow/engine`, `npm test --workspace @verseglow/engine` (5 passing), `npm run typecheck --workspace @verseglow/desktop`, and `npm run build --workspace @verseglow/desktop`.
- `pnpm` is unavailable in this environment, so npm workspaces are being used while retaining a pnpm workspace manifest. Align package manager/lockfile before CI/release.
- No Tauri native integration, Windows player integration, real visual/browser preview, screenshots, or service integrations have been verified yet.