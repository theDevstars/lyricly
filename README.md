# Lyrica

Time-synced lyrics for whatever is playing in **Spotify** or **Apple Music**, rendered in
swappable animated styles by a Windows system-tray app.

Built with Tauri 2 (Rust) and React + TypeScript, drawing each style on Canvas 2D.

## What it does

- Reads the now-playing track from the **Windows media session**
  (`GlobalSystemMediaTransportControlsSessionManager`), so Spotify and the Apple Music app both
  work with no account, token or permission prompt. Playback position is interpolated between
  timeline events, so lyrics stay smooth between samples.
- Fetches timed lyrics from **LRCLIB** and caches them in **SQLite**. Word timings from enhanced
  LRC are used when a record has them; otherwise each line's real duration is split across its
  words by syllable count.
- Runs entirely from the **tray** — no taskbar button — with single-instance behaviour, a
  Windows `Run`-key launch-at-login option, and the Tauri updater plugin wired in.

## Windows

**Lyrics window** — frameless, transparent, always-on-top, draggable by its top bar and resizable.
The top bar carries player status dots for Spotify and Apple Music, a ±100 ms nudge control, the
style picker and a pause/play pill. Size and position are remembered between runs.

**Ambient mode** — a full-screen, click-through overlay (`WS_EX_LAYERED | WS_EX_TRANSPARENT`) on a
chosen monitor, pinned topmost so it sits above borderless-fullscreen apps. Toggle it from the tray,
the settings window, or the global hotkey (`Ctrl+Alt+L` by default); it can also appear on its own
after a configurable idle period. It steps aside for exclusive-fullscreen apps, detected by a window
the desktop compositor cannot report frame bounds for (that is what a swapchain looks like from
outside). **Wallpaper layer** re-parents the overlay to the `WorkerW` behind the desktop icons.

**Style gallery** — Preferences → Styles. Three columns of cards, each with a gradient thumbnail,
its name, a one-line description and a live preview of that style on hover.

## Styles

Each style is a module implementing `LyricStyle`:

```ts
render(ctx: CanvasRenderingContext2D, state: StyleState): void
```

where `state` carries the lines, `activeIndex`, per-word `wordProgress`, the track and the palette.

**Kinetic type — the words themselves move**

| Style | What it does |
| --- | --- |
| Ship | Words land one by one on a wall that drifts in 3D |
| Fisheye | A tight stack of three words, bulging through a lens |
| Visual | A centered stack with an icon for every word that has one |
| Fisheye Visual | Fisheye, with icons beside the words that have one |

**Motion scenes — the words draw a picture as they go**

| Style | What it does |
| --- | --- |
| Codestyle | The lyric typed out as code, with a blinking red cursor |
| Codestyle Visual | Codestyle, with an icon for every word that has one |

## Build

Requires Node 18+, Rust (stable, `x86_64-pc-windows-msvc`) and the **Visual Studio Build Tools**
C++ workload with the Windows SDK, which Rust needs in order to link.

```bash
npm install
npm run tauri dev      # run with hot reload
npm run tauri build    # release exe + NSIS installer
```

The release executable is `src-tauri/target/release/lyrica.exe` (also copied to `release/Lyrica.exe`)
and the installer lands in `src-tauri/target/release/bundle/nsis/`.

## Layout

```
src-tauri/src/media.rs     SMTC session reading and transport control
src-tauri/src/lyrics.rs    LRC / enhanced-LRC parser, syllable split, LRCLIB client
src-tauri/src/db.rs        SQLite lyric cache
src-tauri/src/overlay.rs   layered click-through, WorkerW, fullscreen + idle detection
src-tauri/src/tray.rs      tray icon and menu
src-tauri/src/lib.rs       runtime, polling loop, commands
src/styles/                the LyricStyle modules and their registry
src/windows/               lyrics, ambient and preferences windows
src/components/            canvas stage and gallery preview
```

## Notes

- The updater is registered but has no endpoints or signing key configured yet; publishing updates
  needs `TAURI_SIGNING_PRIVATE_KEY` and a real `pubkey` in `tauri.conf.json`.
- Fullscreen detection is a heuristic: exact for compositor-bypassing games, and borderless apps are
  left alone, but a layered fullscreen app is deliberately never treated as exclusive.
