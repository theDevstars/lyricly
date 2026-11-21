# VerseGlow

VerseGlow is an original, wallpaper-inspired lyrics desktop app. The current foundation is a **demo-only preview**: it uses an invented track and generated CSS album art; it does not yet connect to Spotify, Apple Music, Cider, Windows SMTC, external lyric services or multiple displays.

## Run the preview

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (default `http://127.0.0.1:5173`). Use the bottom controls to pause, seek or advance the invented demo track; use the Styles control or the side arrows to switch the presentation.

## Run as a Windows desktop app

Tauri 2 support is scaffolded under `apps/desktop/src-tauri` and the Rust crate passes `cargo check` for the configured Windows target. Building/running the native app requires Rust, the Tauri CLI and the Windows prerequisites described in the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) guide.

```sh
npm run tauri --workspace @verseglow/desktop -- dev
```

Only the native shell is wired up so far; tray, SMTC, account and overlay functionality are future milestones.

## Project layout

- `apps/desktop`: React/Vite preview and Tauri shell.
- `packages/engine`: shared timing/state model, invented demo timeline, LRC parser and phrase helper.
- `packages/styles`: style metadata, renderer contract and initial Constellation canvas renderer.
- `packages/ui`: reserved for shared UI components and tokens.

The repo includes `pnpm-workspace.yaml` to retain the intended pnpm layout. This environment did not have pnpm, so npm workspaces and `package-lock.json` are used during initial development. Align the package manager before CI/release.

## Checks

```sh
npm run build --workspace @verseglow/engine
npm test --workspace @verseglow/engine
npm run typecheck --workspace @verseglow/desktop
npm run build --workspace @verseglow/desktop
```

## Product/legal notes

All current demo lyrics are invented. Do not commit real lyrics, commercial album covers, user artwork, provider secrets, or the supplied visual-reference archives. Service integrations must use minimum scopes, honor provider terms/attribution, and keep secrets out of logs and source control. Ambient mode is an ordinary app window; it cannot replace the secure Windows lock screen.
