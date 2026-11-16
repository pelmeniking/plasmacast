# CLAUDE.md

plasmacast is a Raycast-style launcher for **KDE Plasma 6 on Wayland**. It is a
fork of typecraft's omacast (`typecraft-dev/oma-cast`), which was written as a
plugin for Omarchy's shell on Hyprland. This fork runs standalone: Quickshell
loads `shell.qml` from the checkout, started by a systemd user service.

Upstream's build plan (`SPEC.md`) and its Raycast analysis notes (`reference/`)
are not part of this fork. Code comments that say `upstream SPEC §…` or
`ref 02 §…` point into those files in the upstream repository. The tags in
comments mean: **[O]** behaviour observed in Raycast, **[I]** inferred,
**[D]** a design decision of this project.

## Ground rules

1. **No Raycast code or assets**, and never call `*.raycast.com`.
2. **No telemetry and no AI features.** The only network request is the daily
   exchange-rate fetch from frankfurter.dev, which `"currencyRates": false`
   in `config.json` turns off.
3. **No user text in argv.** Queries, calculator text and commands the user
   typed go to other processes on stdin (`services/ClipboardWriter.qml`,
   `services/TerminalRunner.qml`), never as arguments.
4. **Private files stay private.** plasmacast's directories are `0700` and its
   store files `0600`; `tests/privacy.test.js` checks this.
5. **Keep dependencies near zero.** QML and plain JS, plus what Plasma already
   ships (Quickshell, Qt, bash, `kstart`, `busctl`, `gdbus`, `wl-copy`). No
   npm packages. Don't bring back kdotool: with it installed, other programs
   poll KWin through it and the desktop stutters.
6. **The ranker is a port, not a fuzzy matcher.** `core/Ranker.js` and
   `core/Frecency.js` follow Raycast's root-search ranking and have golden
   tests. Don't swap in fzf-style scoring.
7. **Tests stay green, and new behaviour gets a test.**

## Layout

```
shell.qml                # entry point Quickshell loads
Launcher.qml             # open/close, IpcHandler target "plasmacast"
Backend.qml              # in-process backend: paths, config.json, stores, RPC registry
ui/                      # the launcher window and its parts
services/                # QML that does I/O (JsonStore, AppFocuser, TerminalRunner, …)
core/*.js                # pure logic, no Qt imports; shared by QML and the node tests
Commons/                 # KDE stand-ins for omarchy-shell's Style/Color/Util/Border
kde/menu.jsonc           # the built-in KDE actions; users add theirs in ~/.config/plasmacast/menu.jsonc
kde/config.example.json  # template for ~/.config/plasmacast/config.json
bin/plasmacast           # bash CLI: install, setup kde, doctor, restart, log, call, …
bin/plasmacast-focus     # focuses an app's open window through KWin's D-Bus interface
search/, bin/build-search  # optional Rust matcher; the built-in JS matcher works without it
tests/*.test.js          # node --test unit tests
```

Rules for `core/*.js`: one self-contained file per module. QML `import "x.js"`
and node `require` must both work, so a module never imports another one, and
it exports through `if (typeof module !== "undefined") module.exports = …`.
QML wires the modules together.

Much of the code still carries Omarchy names and branches: `OmarchyMenu`,
menu ids with the `omarchy:` prefix (kept so stored favourites and rankings
stay valid), `backend.appLibrary`, `summon`, the Hyprland check in
`Backend.qml`. On KDE `appLibrary` is always null and those branches never
run. `README.omarchy.md` is upstream's README, kept for reference.

## Commands

```sh
node --test tests/*.test.js   # unit tests (node's built-in runner; no npm install)

plasmacast restart            # restart the service
plasmacast log                # follow its log
plasmacast doctor             # check that the pieces are in place
plasmacast call <method> [json]   # any backend method, e.g. plasmacast call system.info
plasmacast run <commandId>    # e.g. plasmacast run omarchy:system.lock
```

`tests/smoke.sh` runs live checks against the running launcher; it shows and
hides the window but never types.

**Reloading.** The service runs straight from this checkout, and Quickshell
reloads when files change. A reload in the middle of a `git switch` or merge
can fail with "Config reload failed … is not a type"; Quickshell then keeps the
old version running. Run `plasmacast restart` once the tree is settled and
check `plasmacast log` for QML errors before concluding a change works. A QML
error shows as "Type X unavailable" with the real cause on the next line.

## KDE specifics

- **Shortcut.** `plasmacast setup kde` writes a `.desktop` file whose
  `X-KDE-Shortcuts` binds Alt+Space through kglobalaccel, and takes that key
  from KRunner (which keeps Alt+F2). `IpcHandler` functions need typed
  parameters and must return a string.
- **Launching apps** goes through `kstart --application`, like Kickoff.
- **Focusing an open window** asks KWin over D-Bus (`bin/plasmacast-focus`):
  `/WindowsRunner` `Match` finds candidates, `getWindowInfo` checks the exact
  class or desktop file, `Run` activates.
- **Theme.** Colours and the font come from the Plasma colour scheme through
  `Commons/Color.qml` and `Commons/Style.qml`.
- **Settings pages.** `kcm_*.desktop` entries are hidden but searchable.
- **Errors in user files.** A broken `config.json` or `menu.jsonc` is ignored
  and reported as a failure toast when the launcher opens
  (`Schema.problemSummary`).
- **Testing on the live desktop.** Don't synthesize keystrokes unless the
  launcher is already mapped and focused; early keys go to the window
  underneath. The query survives hide and show until pop-to-root, so clear it
  (Ctrl+U) before a live test.

## Known gaps

- No settings window. A disabled command comes back only through Undo on the
  toast (Ctrl+T) or by removing its `enabled: false` from
  `~/.local/share/plasmacast/db/settings.json`.
- The interface is English only.
- "Paste Answer" in the calculator needs ydotool or dotool; without them it
  only copies.
- `.github/workflows/ci.yml` asks for upstream's WarpBuild runner
  (`warp-ubuntu-latest-x64-2x`), which this fork's account may not have.
