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
| Messages | The song plays out as an iMessage thread, one bubble per line |

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

## Lyrics sources

Sources are tried in the order set in Preferences → Sources; each can be switched off, and a
result below the confidence threshold falls through to the next one.

| Source | Access | Notes |
| --- | --- | --- |
| Cider / Apple Music | Cider's local API | Apple Music's own lyrics from the app you already run, word-synced when available. |
| Local cache & files | Your disk | Cached results plus `.lrc` / `.txt` files you supply for a track. |
| LRCLIB | Official, keyless | Free community database. |
| Musixmatch | Official API, your key | Free plans return a truncated body and require the copyright line to be shown; Lyrica shows that line and never presents truncated text as complete. |
| Genius | Official search, terms-sensitive text | The `/search` API is official, but lyrics are read from song pages only after an explicit opt-in, because that goes against Genius' terms of service and may break at any time. Page reads are limited to one per second with an honest User-Agent. |

**Timing.** Word-synced and line-synced lyrics are used as-is. Plain lyrics can be given
estimated timing — spread across the track by syllable count, after skipping the intro — and
are marked *estimated* in the app. The nudge offset applies to every source.

**Data.** Lyrics live in a local SQLite cache for personal display only. Nothing is uploaded
anywhere, and no lyrics text is stored in this repository. Optional sources stay off until you
enable them; you are responsible for the keys you add and for the terms of the services you
use.

## Players

**Spotify**, **Apple Music** and other Windows media apps come through the system media
session (SMTC); nothing to configure.

**Cider** (cider.sh) is detected through SMTC too — it just looks like another Apple Music
player — and additionally can be read from its local API for exact position, duration and
artwork. Enable it under Preferences → Players.

- Host and port default to `localhost:10767`.
- The API token comes from Cider under **Settings → Connectivity → Manage External
  Application Access to Cider**, and is stored in the Windows Credential Manager (target
  `lyrica/cider-token`). It is sent as the `apptoken` header, and also as `apitoken` so the
  legacy generation keeps working if it accepts it. Tokens are never written to
  `settings.json` and never logged.
- Only Cider's current **v2** REST API (`/api/v2/client/info`, `/api/v2/playback`,
  `/api/v2/lyrics/current`) is implemented. A v1 server is detected and reported as such
  rather than guessed at; it stays usable through SMTC.
- Position comes from Cider's Socket.IO `API:Playback` channel over WebSocket (Engine.IO v4):
  `playbackStatus.playbackTimeDidChange` drives the clock about once a second,
  `playbackStatus.playbackStateDidChange` drives play/pause, and a track change triggers a
  single REST read for metadata. The socket reconnects with backoff; while it is down, or
  silent for 5 s, Lyrica falls back to polling the REST API, so a dropped socket only costs
  precision, never playback.
- Lyrics come from `/api/v2/lyrics/current?words=true` when Apple Music has them, which can
  be word-synced, line-synced or plain. The provider is listed first among lyric sources but
  refuses results whose track does not match what is playing.

## Notes

- The updater is registered but has no endpoints or signing key configured yet; publishing updates
  needs `TAURI_SIGNING_PRIVATE_KEY` and a real `pubkey` in `tauri.conf.json`.
- Fullscreen detection is a heuristic: exact for compositor-bypassing games, and borderless apps are
  left alone, but a layered fullscreen app is deliberately never treated as exclusive.
