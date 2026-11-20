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
  words by syllable count. Scripts written without spaces (Chinese, Japanese kana, Thai, Lao,
  Khmer, Myanmar) are split per character instead, so per-word styles still step through them.
- **Hides itself from screen capture** on Windows 10 2004 and newer: the lyrics windows are marked
  `WDA_EXCLUDEFROMCAPTURE`, so they stay on your monitor but never appear in OBS, Discord, Teams
  or a screen recording. Toggle it from the tray, the settings panel, or `Ctrl+Alt+S`.
- Runs entirely from the **tray** — no taskbar button — with single-instance behaviour, a
  Windows `Run`-key launch-at-login option, and the Tauri updater plugin wired in.

## Windows

**Lyrics window** — frameless, transparent, always-on-top, draggable by its top bar and resizable.
The top bar carries player status dots for Spotify and Apple Music, a ±100 ms nudge control, the
style picker and a pause/play pill. Size and position are remembered between runs.

**Late Night** — a full-screen, lock-screen-styled screen for an idle evening: a large thin-weight
clock with the date above it near the top of the screen, the current track and an exit hint at the
bottom, on black or over a dimmed desktop, on one chosen monitor or mirrored across all of them.
Open and close it with its global hotkey (`Ctrl+Alt+K` by default), the tray item, or the Ambient
tab; any mouse movement past a 2 px dead zone (after a short grace period), key press or click
fades it out over 300 ms. It can also appear on its own after N idle minutes while music is
playing, or the moment playback starts. While it is up it holds the display awake with
`SetThreadExecutionState` so the screen does not dim underneath, steps aside for
exclusive-fullscreen apps, and closes when the session locks — reopening after unlock when that
setting is on.

*Limitation:* Windows does not let an ordinary application draw on the real lock screen (Win+L).
Late Night is a desktop takeover designed to look like one; it never touches the actual lock
screen, the session stays unlocked and other apps keep running. Battery, Wi-Fi and volume
indicators are not drawn yet.

**Ambient mode** — a full-screen, click-through overlay (`WS_EX_LAYERED | WS_EX_TRANSPARENT`) on a
chosen monitor, pinned topmost so it sits above borderless-fullscreen apps. Toggle it from the tray,
the settings window, or the global hotkey (`Ctrl+Alt+L` by default); it can also appear on its own
after a configurable idle period. It steps aside for exclusive-fullscreen apps, detected by a window
the desktop compositor cannot report frame bounds for (that is what a swapchain looks like from
outside). **Wallpaper layer** re-parents the overlay to the `WorkerW` behind the desktop icons.

**Style gallery** — Preferences → Styles. Three columns of cards, each with a gradient thumbnail,
its name, a one-line description and a live preview of that style on hover.

## The window

The tray is still the home of the app, but **Lyrica** (tray → *Open Lyrica*, or a left click on the
tray icon) is a normal resizable window for previewing, picking and configuring styles:

- a built-in **demo track** — invented lyrics with real word-level timings, looping for about 25
  seconds — so a style can be judged without any music playing, plus a **Preview: Demo / Now
  playing** switch, play/pause, a scrubber, arrow buttons and the left/right keys to step through
  all thirteen styles;
- **Select** applies the previewed style to every display, **Pin** keeps it in the tray quick list
  (five at most);
- style tiles grouped by Kinetic type, Motion scenes and Native Design, with a check on the active
  style and a pin on the pinned ones;
- a settings drawer with **Size** (50–200%), **Font** family and weight, **Ambient screen**
  switches (lyrics on the desktop vs ambient only, keep the screen awake) and **Aesthetics**
  (Auto Sync, the three colour wells, Reset colours, and a warning when a choice falls under the
  4.5:1 AA contrast ratio).

The preview renders through the same `StyleCanvas` the real displays use, so what you see is what
the screen shows. The taskbar button only exists while this window is open. The first launch opens
it as the onboarding step.

The tray itself is short by design: Open, pinned styles, Keep Screen Awake, Show on desktop, Text
Size, the monitor list, Late Night, License… and Quit.

## Licensing

Keys are signed offline. A key is `LYRICA1.<payload>.<signature>`: URL-safe base64 of a small JSON
document and an Ed25519 signature over it. Only the public half is compiled into the app, so
activation needs no network call and no secret ships in the binary. A fresh install starts a
14-day trial; an expired key or trial leaves the app usable for reading lyrics but reports its
state in **License…**.

Note: the Lyrica install is not currently gated on the license state — the state is reported, not
enforced. Keys live in Windows Credential Manager (`lyrica/license-key`), never in `settings.json`.

Issuing a key needs the signing key, which is **not** in this repository
(`src-tauri/license-signing-key.txt`, git-ignored):

```bash
cd src-tauri
cargo run --example keygen -- new                     # once; prints the public key
cargo run --example keygen -- sign "Name" --days 365  # prints a key for that name
```

If you regenerate the signing key, put the new public key into `PUBLIC_KEY_HEX` in
`src-tauri/src/license.rs`. Keep the signing key offline and backed up: keys signed by a lost key
cannot be verified by any build.

## Styles

Each style is a module implementing `LyricStyle`:

```ts
render(ctx: CanvasRenderingContext2D, state: StyleState): void
```

where `state` carries the lines, `activeIndex`, per-word `wordProgress`, the track and the palette.

The timing never changes between styles — only the way the words appear does. Every style reads
the same `LyricState`, so word-level timing looks the same whether it comes from enhanced LRC or
from the syllable estimator.

**Kinetic type — the words themselves move**

| Style | What it does |
| --- | --- |
| Ship | Words land one by one on a wall that drifts in 3D |
| Fisheye | A tight stack of three words, bulging through a lens |
| Visual | A centered stack, with an icon for every word that has one |
| Fisheye Visual | Fisheye, with icons beside the words that have one |

**Motion scenes — the words draw a picture as they go**

| Style | What it does |
| --- | --- |
| Codestyle | The lyric typed out as code, under a blinking red cursor |
| Codestyle Visual | Codestyle, with icons beside the words that have one |
| Branches | A line draws itself, and each word lights a node on it |
| Web | Each line spun into a spider's web, a strand for every word |
| Constellation | Each line traced as a constellation, star by star |

**Native Design — the lyric as an interface you know**

These four keep their own colours; the colour settings leave them alone.

| Style | What it does |
| --- | --- |
| Native Design | The song as a message thread, a bubble for every line |
| Native Design Money | The song as a run of payments, one for every line |
| Native Design Map | A walk across a city, with a pin for every line |
| Native Design Notifications | Lines arrive as lock-screen notifications, stacks and widgets |

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

If nothing lines up, **tap to sync** (`Ctrl+Alt+T` by default) records the start of each line
while the track plays and writes an `.lrc` override for it; overrides take precedence over every
provider and load on the next play.

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
