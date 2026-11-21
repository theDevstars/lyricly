# VerseGlow — implementation plan

> Step 1 planning document. No application code has been started. Product requirements are staged so each milestone can be reviewed and tested before expanding scope.

## Product and scope

Build **VerseGlow**, an original Windows 10/11 system-tray lyrics and ambient-display app. A single shared playhead and `LyricState` feed every renderer; styles change presentation, never timing. Keep account linking optional, use built-in invented demo content, and do not bundle commercial lyrics, album art, service branding, or map tiles.

The supplied specification describes a very large product. Implement in the requested sequence, keeping a usable vertical slice at each checkpoint rather than pretending every listed feature can be delivered in one pass. Each stage ends with a concise user-facing summary, verification results, and explicit unverified items. Commit after each approved/completed step when repository Git is available.

## Architecture

- **Monorepo:** pnpm workspace with `apps/desktop` (Tauri 2, Rust, React/TypeScript), `packages/engine` (pure lyric/timing/player arbitration logic), `packages/styles` (registry and isolated renderers), `packages/ui` (shared components/tokens), and `server/apple-token` (optional Apple Music developer-token signer).
- **Rust owns OS integration and secrets:** SMTC, tray, hotkeys, display/window management, local settings/cache, optional audio loopback, and credential storage. Keep provider HTTP and OS-specific operations out of renderer code where practical.
- **Shared playback model:** one authoritative engine emits typed `LyricState` updates; a broadcast/event abstraction supplies current state immediately to newly created windows and all displays. Renderer styles consume only that state.
- **Settings:** versioned schema, migrations and one-step rollback; non-secret preferences in app-data JSON (or SQLite where appropriate); tokens in Windows Credential Manager. Diagnostics redact secrets and personal data.
- **Rendering:** a strict `LyricStyle` lifecycle contract and registry keyed by stable style IDs. Lazy-load heavy styles; dispose animation frames, observers, event listeners and graphics resources. Respect reduced motion and photosensitivity settings.
- **Tests/CI:** pure unit tests first, then renderer contract tests, scripted demo playback, and Windows release verification. CI runs formatting, lint, type checks, unit tests and browser style checks; platform-specific checks are identified rather than falsely claimed on non-Windows hosts.

## Proposed repository structure

```text
.
├── apps/desktop/
│   ├── src/                         # React screens, windows, settings UI
│   └── src-tauri/
│       ├── src/{players,lyrics,audio,displays,desktop,overlay,stream,settings}/
│       ├── capabilities/
│       └── tauri.conf.json
├── packages/
│   ├── engine/src/                  # LyricState, parsers, timings, arbitration
│   ├── styles/src/                  # registry and style modules
│   └── ui/src/                      # tokens and shared accessible components
├── server/apple-token/              # optional token signer; key held as host secret
├── tests/                           # fixtures and cross-package contracts
├── PLAN.md
├── DECISIONS.md
├── package.json
├── pnpm-workspace.yaml
└── ... CI, docs, and licensing metadata
```

The Rust module/file tree will be expanded as each stage is implemented; avoid creating placeholder modules for features not yet built.

## Delivery sequence and exit checks

1. **Plan (current):** architecture, repository shape, risks and explicit decisions; verify current Cider, Spotify and MusicKit documentation. Stop for user review before major work.
2. **Foundation:** initialize workspace, app identity/config, settings schema and migrations, shared models/contracts, style registry, invented DemoPlayer and MockPlayer, structured logging and CI. Exit: clean install/build, lint/type/unit checks pass; settings migration and style lifecycle tests pass.
3. **Playback and lyrics core:** Windows SMTC session integration; LRCLIB lookup/cache/matcher; LRC parser; shared engine, interpolation, seek handling and per-track nudge; debug state view. Exit: deterministic fixtures and provider/error tests pass; verify SMTC on Windows.
4. **Lyrics window and first renderers:** frameless lyrics window, pause/play view control and first four styles (Messages, Constellation, Fisheye, Karaoke Sweep); style lifecycle/geometry harness. Exit: each passes contract tests at requested sizes and scripted seeking.
5. **Home, tray and status:** demo-backed style carousel/grid, selection/pinning, onboarding tour, core settings, tray/flyout and player checklist. Exit: keyboard-accessible flows and settings persistence tests.
6. **Displays and Ambient:** stable monitor identification, per-display profiles, state sync, Ambient clock/controls, Now Playing and art backdrop. Exit: hotplug/reconnect and multi-window state tests; Windows multi-monitor verification.
7. **Rim Light and beat reaction:** transparent per-monitor overlay, cutout geometry and optional loopback FFT. Exit: CPU/fallback behavior, pause/no-audio behavior, Windows overlay checks.
8. **Remaining styles in reviewed batches:** add the specified style groups and shared effects in small batches; each is registered only after passing the renderer contract. Exit: contract and performance checks per batch.
9. **Desktop Scene:** WorkerW attachment with bounded retries and floating fallback, widgets, edit mode and recovery controls. Exit: Explorer restart/re-attach and Windows 10/11 checks.
10. **Accounts and sources:** Cider adapter, Spotify PKCE, MusicKit bridge/token signer, source arbiter, queue support and optional controls. Exit: auth/error/permissions tests, no-secret diagnostics, and user-facing disconnect/delete behavior.
11. **Lyrics tools:** optional providers, timing/editing, history, translation/romanization and share card. Exit: provider attribution/opt-in and local data handling checks.
12. **Streaming:** capturable stream window, loopback-only authenticated OBS endpoint, capture-exclusion preference and optional sharing integrations. Exit: binding/auth/CORS and capture checks.
13. **Quality and reliability:** rules, hotkeys, diagnostics, troubleshooting, localization, links and comfort/performance modes. Exit: redaction, link allowlist, rules and hotkey tests.
14. **Release:** licensing/updater/onboarding/installer/docs and compliance notes. Exit: release-build tests on Windows 10/11, sleep/wake, single/two displays, offline/provider failures, Explorer restart, package/CSP/capability review.

## Main risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope is much larger than a single implementation pass | Preserve sequence; ship vertical slices; review milestones and defer optional features transparently. |
| Windows-specific windows, SMTC and WorkerW behavior cannot be fully tested on other OSes | Keep OS boundaries isolated; add pure tests and clearly require Windows release verification. |
| Third-party player APIs and docs change; Cider's newer socket behavior is not fully established | Treat documented REST as baseline; probe user-configured local service; isolate adapters; do not depend on undocumented socket behavior. |
| Spotify developer-mode allowlist and account requirements constrain distribution | Explain current limitations in Accounts/docs; keep SMTC as zero-setup baseline; avoid promising broad access. |
| Apple Music developer-token signing needs account/key provisioning and a deployed signer | Keep integration optional; never ship signing key; provide deployment/configuration requirements and fail clearly when unset. |
| Lyrics source rights/terms and low-confidence matches | Attribute providers; prioritize lawful APIs; no bundled real lyrics; opt-ins and warnings; confidence threshold and wrong-match UX. |
| Renderer timing/layout bugs, resource leaks or photosensitivity | One state model; deterministic frame-derived word state; style contract suite; reduced-motion and frequency limits. |
| Overlay capture, click-through and display lifecycle edge cases | Explicit fallback modes, panic hide, per-display IDs, and Windows test matrix before claiming support. |
| Secrets or user data leak through logs/cache/diagnostics | Credential Manager for secrets, local-only defaults, explicit optional network features, redaction tests and no runtime art persistence. |

## Initial foundation status

- Workspace and initial web-rendered wallpaper scene are scaffolded. The scene uses generated CSS art and the invented 24-second demo track, with compact playback/seek and style switching.
- Shared engine includes `LyricState`, word-state derivation, demo timeline, LRC parsing and phrase splitting. First renderer is Constellation; the catalog currently lists the four first milestone styles, but only Constellation is currently registered as a lifecycle renderer.
- Engine tests (5), engine build, desktop typecheck and desktop production web build pass. This is a browser-based shell, **not yet a Tauri executable**.
- npm was used because pnpm is not installed; package-manager alignment remains before CI.

## Current API/documentation verification (2026-11-21)

- **Cider:** current Cider Docs RPC reference documents a local API at `http://localhost:10767`, optional application token in the `apptoken` header (no Bearer prefix), and playback endpoints under `/api/v1/playback` including `/active` (`204`) and `/is-playing`. The docs/search surfaced a legacy REST API on port `9000` and reports of Socket.IO incompatibilities. Treat documented RPC REST as the initial adapter contract; do not assume the prompt's guessed now-playing WebSocket/socket.io paths or event protocol. Inspect the full current RPC endpoint/schema and test against supported Cider versions before implementing. Source: [Cider client RPC docs](https://github.com/ciderapp/Cider-Docs/blob/main/docs/1.client/rpc.md), [legacy REST docs](https://github.com/ciderapp/Cider-Docs/blob/main/docs/3.legacy-docs/3.legacy-plugins/client-rest-api.md).
- **Spotify:** official docs support Authorization Code with PKCE when a client secret cannot be safely held (desktop); redirect URI must exactly match the registered URI and `state` is strongly recommended. `user-read-playback-state` reads playback/device data; `user-read-currently-playing` reads current track and queue. Keep scopes granular and request write scopes only when enabling controls. Current development-mode docs state the app owner must have Premium and up to five authenticated users may be allow-listed; account for this restriction in onboarding and release documentation. Handle status/rate limits and optional controls as specified. Sources: [Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow), [authorization](https://developer.spotify.com/documentation/web-api/concepts/authorization), [scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes), [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Get Playback State](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback).
- **Apple Music / MusicKit:** official docs require a developer token signed with ES256 using a MusicKit identifier/key; `exp` must be no more than 15,777,000 seconds (six months) after current server time. Subscriber-specific API calls require a Music User Token; MusicKit on the Web manages it for web apps. A signer service is required for safe key custody in this Windows desktop design, and Apple Developer Program credentials are a deployment prerequisite. Linking enriches catalog/library data only; live playback of the separate Apple Music Windows app continues to depend on SMTC/Cider. Sources: [Generating Developer Tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens), [User Authentication for MusicKit](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit), [MusicKit](https://developer.apple.com/musickit/).

Verification is documentation-only at this planning stage; no live integrations have been built or tested.