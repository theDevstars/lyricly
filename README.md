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
the settings window, or the global hotkey (`Ctrl+Alt+L` by default). The **Ambient mode** switch is
the master and is remembered across launches; only while it is on does the idle timer bring the
screen back. A screen you opened yourself stays until you close it, while one the idle timer opened
fades out as soon as you touch the keyboard again. It steps aside for exclusive-fullscreen apps, detected by a window
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

## Releasing

`./scripts/release.sh` does the whole thing in order: build, stage `release/`, refresh the website's installer, hash, size and badge (`site/scripts/sync-release.mjs`), rebuild the site, then replace the assets on the GitHub release for the current version.

```bash
./scripts/release.sh                                   # same version, new build
./scripts/release.sh --version 2.1.0 --notes notes.md  # bump the site and add a changelog entry
SKIP_UPLOAD=1 ./scripts/release.sh                     # build and sync only
```

The site sync never invents a version: without `--version` it keeps the one in `site/site.config.ts` and only makes the download true again. A changelog entry is generated from a small Markdown file — a `# title` line, a summary paragraph, then `## New`, `## Improved` and `## Fixed` lists.

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

## Spotify account (optional)

Lyrica works from the media session, so linking is never required. A linked Spotify account adds three things: the exact position (no sampler drift), the largest artwork, and — on Premium — playback controls.

1. Create an app at <https://developer.spotify.com/dashboard>, keep it in **Development Mode**, and add your own account under **Users**.
2. Add `http://127.0.0.1:8888/callback` as a redirect URI (Preferences shows the exact string, port included).
3. Paste the Client ID into **Preferences → Players → Spotify account** and press **Connect Spotify**.

Details worth knowing:

- The login is Authorization Code with PKCE against a loopback listener; there is no client secret, and `state` is verified before the code is exchanged.
- Tokens live in the Windows Credential Manager (`lyrica/spotify-access`, `lyrica/spotify-refresh`), are refreshed a minute before expiry, and never appear in the settings file or the log.
- Polling adapts: about once a second while playing, once every four seconds when paused or idle, and it backs off for the `Retry-After` window on a 429. A 401 asks you to link again; a 403 on a control means Premium is required.
- When Spotify answers `204` the media session takes over again, so a local file playing in another app still shows its lyrics.
- **Disconnect** deletes the tokens on this PC. Revoking Lyrica's access itself is done in your Spotify account page.
- Scopes are minimal: `user-read-playback-state`, `user-read-currently-playing`, and `user-modify-playback-state` only when controls are switched on.

No Client ID ships with the app, so no developer account is shared between users and Development Mode's user allow-list is yours to manage.

## Apple Music

Apple Music's now-playing state comes from its media session, or from Cider's local API (see above) — Apple publishes no public now-playing endpoint for desktop apps.

Apple's MusicKit JS unlocks the *library* side (playlists, recently played, ISRC lookups, rating a song), not now-playing. It needs a developer token: an ES256 JWT signed with your Apple Music key, which must be minted by a server and must never be shipped inside the app. That server is not part of this release, so Apple Music here stays read-only through the media session. Nothing is stubbed to look finished: there is no Apple connect button yet.

## Quality of life

Everything in **Preferences → Quality of life** is optional and off the hot path: one desktop check every two seconds, on the ticker the ambient screen already owned. Turn the master switch off and the app behaves exactly as before.

### Per-song memory

A nudge made on a song is saved for that song; the ★ button in the window also remembers the style, and can save it for the artist or the album instead. Playback looks the track up by title, artist and duration — never by app — so the same memory follows a track between Spotify, Cider and Apple Music. Artist and album memories supply what a song does not have; the song's own nudge always wins. The file is `song-memory.json` in the app data folder, capped at 4,000 entries with the oldest dropped first.

### Rules

A rule is one condition and one action:

| Condition | Matches when |
| --- | --- |
| fullscreen | a borderless, monitor-sized window owned by another process is in front |
| app | a named process is in front (comma separated, `.exe` optional) |
| battery | the laptop is not on AC |
| videoCall | Teams, Zoom, Webex, GoToMeeting or Discord is in front |
| screenShare | a meeting app or a recorder (OBS, Streamlabs, XSplit) is in front |
| time | the local clock is inside `HH:MM-HH:MM`, wrapping past midnight |

Actions: hide the overlay, use Light mode, pause the ambient screen, switch Streaming mode on, or dim and warm the ambient screen. Every matching rule applies, so conditions compose. **Test** evaluates a rule against the desktop as it is at that moment. Three rules ship enabled (fullscreen hides, a call pauses the ambient screen, battery starts Light mode); the 22:00–07:00 warm schedule ships switched off, because dimming someone's screen at ten is a choice, not a default.

Screen sharing is inferred from which app owns the screen — the share runs inside the meeting process or the recorder. It cannot see a browser tab sharing through Meet, and the app does not pretend to.

### Schedules and theme

Time windows are just `time` rules, so "warm and dim after 22:00" is one rule and "Light mode at 09:00" is another. **Follow the Windows theme** reads `AppsUseLightTheme` and repaints the app chrome; lyric styles keep their own palettes, since a style is a look, not a theme.

### Smart hide

- Paused for the configured number of seconds (12 by default) fades the lyrics out; resuming fades them back.
- A track playing with no lyrics shows a quiet "No lyrics" pill rather than an empty stage.
- A gap of more than 4.5 seconds between lines shows three slow dots, the app's own reading of an instrumental.
- With **Hide when a song loops** on, a track that restarts is not drawn again.

### Light mode

30 fps (frames under 32 ms are skipped), no backdrop blur, no bloom, and the canvas reports its frame time once a second. Five slow frames in a row (26 ms or more) trip it, and one healthy frame clears it. It also follows battery saver, and any rule can ask for it. The setting is `auto`, `on` or `off`, so an automatic decision is always overridable. The notice in the panel says why it is on.

### Sleep timer

30, 60 or 90 minutes, or "when the queue ends". The ambient screen fades over 1.4 seconds and closes; playback is never touched, and the timer clears itself after firing.

### Games and fullscreen

A fullscreen app always sends the overlay away, matching the existing fullscreen rule. A process listed under **Draw over these** opts in and keeps the overlay anyway; one under **Never draw over these** is respected even when its window is not fullscreen. Both lists are process names without `.exe`.

### What this pass does not do

The app has no Rim Light FFT, no per-display profiles and no 3D style group, so Light mode cannot pause or thin those: it lowers the frame rate and drops compositing instead. Light mode is per renderer, not per style. Detection is Windows-process based; a browser tab, a virtual machine or a game with an unusual fullscreen mode can still be misread.

## Notes

- The updater is registered but has no endpoints or signing key configured yet; publishing updates
  needs `TAURI_SIGNING_PRIVATE_KEY` and a real `pubkey` in `tauri.conf.json`.
- Fullscreen detection is a heuristic: exact for compositor-bypassing games, and borderless apps are
  left alone, but a layered fullscreen app is deliberately never treated as exclusive.
