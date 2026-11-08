# plasmacast

**A Raycast-style launcher for KDE Plasma 6 (Wayland).** It learns what you use, searches your apps,
every System Settings page and a set of Plasma actions, and follows your color scheme.

> **Status: personal project, provided as is.** I built it for my own desktop, and it works on my
> machine. [Issues](https://github.com/pelmeniking/plasmacast/issues) are welcome, but I can't promise
> fixes or a schedule. plasmacast is not an official KDE project, and typecraft doesn't support it:
> please report plasmacast problems here, not upstream.

## Why this exists

The other launchers I'd tried on Linux all felt a bit dull to me. Then I came across omacast and asked
Claude whether something like it could run on KDE as well. One question led to the next, and
plasmacast is what came out of it. It wasn't planned; it happened more or less by accident.

## Where it comes from

plasmacast is a fork of [omacast](https://github.com/typecraft-dev/oma-cast) by typecraft, which is
built for [Omarchy](https://omarchy.org) and runs inside `omarchy-shell` on Hyprland. The search, the
ranking (a port of Raycast's root-search algorithm with frecency and learned search terms), aliases,
favorites, the calculator and the Ctrl+K action panel are omacast's. plasmacast replaces everything that
depended on Omarchy and Hyprland. The port was written with Claude (Anthropic) and is tested on
CachyOS with Plasma 6.

## What it does on Plasma

- **Apps** start through `kstart`, like Kickoff. With [`kdotool`](https://github.com/jinliu/kdotool)
  installed, ↵ switches to an app's open window instead of starting another one (Shift+↵ always opens new).
- **Shell commands:** type `ping -c3 1.1.1.1` and ↵ runs it in your terminal (the one set in System
  Settings › Default Applications, else Konsole). Run in Terminal leads the fallbacks when the first word
  is a command on your PATH; start with `>` to force it (`> make deploy`). The command runs in an
  interactive `$SHELL`, so your aliases work, and the window stays open afterwards. `PLASMACAST_RUN=1`
  is set there, so your rc file can skip a banner: `[[ -z $PLASMACAST_RUN ]] && fastfetch`.
- **System Settings pages** are searchable one by one (“Display”, “Bluetooth”, “Shortcuts”…), from the
  same `kcm_*.desktop` entries KRunner uses.
- **Plasma actions** ([`kde/menu.jsonc`](kde/menu.jsonc)):
  - System: lock, sleep, hibernate (when available), log out, restart, shut down (the last three ask
    first), power profile, restart Plasma
  - Appearance: dark/light mode, color scheme and global theme submenus with ✓ on the current one,
    night light
  - Windows: Overview, Grid View, Present Windows, Show Desktop, Kill Window
  - Screenshot (Spectacle): region, screen, all screens, window, record region
- **Looks native:** colors come from your Plasma color scheme and change live when you switch; text
  uses your system font; feedback uses Plasma's OSD.

### Search engines

Under every query plasmacast offers web searches (Google, then DuckDuckGo by default). Choose and order
your own with `plasmacast config` (or “Edit plasmacast Settings” in the launcher), which opens
`~/.config/plasmacast/config.json`:

```json
{
  "searchEngines": [
    { "title": "DuckDuckGo", "url": "https://duckduckgo.com/?q={query}", "keywords": ["ddg"] },
    { "title": "Startpage", "url": "https://www.startpage.com/do/search?q={query}" },
    { "title": "ArchWiki", "url": "https://wiki.archlinux.org/index.php?search={query}", "keywords": ["aw"], "fallback": false }
  ]
}
```

- The order is the order under your query; leave an engine out to drop it (`[]` keeps only Run in Terminal).
- `url` must be http(s) and contain `{query}`.
- Every engine is also a quicklink: type “ArchWiki” or its keyword `aw`, press Tab, then the query.
  The first keyword works like an alias: typed exactly, it puts the quicklink on top (`gh` beats Ghostty).
  `"fallback": false` makes it a quicklink only.
- Optional `icon`: a Nerd Font glyph. Changes apply when you save; mistakes show up in `plasmacast log`.

### Your own actions

Add your own entries in `~/.config/plasmacast/menu.jsonc` (“Edit plasmacast Menu” opens it). Same
format as `kde/menu.jsonc`; the same id overrides, a new one adds:

```jsonc
{
  "dev": {"iconName":"utilities-terminal","label":"Dev"},
  "dev.restart-docker": {"iconName":"view-refresh","label":"Restart Docker","action":"pkexec systemctl restart docker"}
}
```

## Install (Arch / CachyOS)

```sh
sudo pacman -S --needed quickshell ttf-nerd-fonts-symbols wl-clipboard
paru -S kdotool-bin                    # optional: focus open windows
git clone https://github.com/pelmeniking/plasmacast ~/repos/plasmacast
~/repos/plasmacast/bin/plasmacast install     # systemd user service + CLI in ~/.local/bin
plasmacast setup kde                          # bind Alt+Space (asks first)
plasmacast doctor
```

`plasmacast setup kde` lists what it changes and asks. Alt+Space belongs to KRunner by default; setup
takes only that key (KRunner keeps Alt+F2) and remembers the old binding. Another key:
`plasmacast setup kde --key Meta+Space`. Afterwards plasmacast appears in System Settings › Keyboard ›
Shortcuts, where you can change it. No re-login needed.

Optional:

- `ydotool` (with `ydotoold` running) or `dotool`: the calculator's “Paste Answer” types the answer.
  KWin gives normal apps no virtual keyboard, so `wtype` doesn't work on Plasma.
- Rust (`cargo`): `plasmacast install` then builds the faster, typo-tolerant search helper in `search/`.
- `systemctl --user edit plasmacast` to set `PLASMACAST_FONT`, `PLASMACAST_FONT_SIZE`,
  `PLASMACAST_RADIUS` or `PLASMACAST_OPACITY` (0.5–1).

### Remove

```sh
plasmacast uninstall   # service, shortcut and CLI link; KRunner gets Alt+Space back
```

Your data stays in `~/.config/plasmacast`, `~/.local/share/plasmacast`, `~/.cache/plasmacast` and
`~/.local/state/plasmacast`.

## Updates

plasmacast runs straight from its checkout: `git pull`, then `plasmacast restart`.

## Privacy and network

Search history, learned terms and calculator history stay on your machine in owner-only files. Copied
text goes to `wl-copy` on stdin, never on a command line. The only network request is the calculator's
currency rates (ECB, from `api.frankfurter.dev`, at most every 12 hours); turn it off with
`"currencyRates": false` in `~/.config/plasmacast/config.json`. No telemetry.

## Keyboard

| Key | Does |
|---|---|
| `↵` / `Ctrl+↵` / `Ctrl+Shift+↵` | First, second or third action |
| `Shift+↵` | Open a new window of an app |
| `Ctrl+K` | Action panel |
| `Ctrl+1`…`9` | Pick a result |
| `↑` on an empty search | Search history |
| `Ctrl+↑` / `Ctrl+↓` | Jump between sections |
| `Ctrl+N` / `Ctrl+P` | Next / previous |
| `Ctrl+Shift+F` | Add to favorites (`Ctrl+Alt+↑↓` to reorder) |
| `Ctrl+Shift+C` | Copy |
| `Esc` / `Shift+Esc` | Back / back to root |
| `Ctrl +` / `Ctrl −` / `Ctrl 0` | Zoom |

## CLI

```sh
plasmacast toggle | show | hide
plasmacast run <commandId>         # e.g. omarchy:system.lock, app:org.kde.dolphin
plasmacast call <method> [json]    # any backend method
plasmacast config                  # open config.json (search engines …)
plasmacast restart | log | doctor
```

Menu ids keep omacast's `omarchy:` prefix so favorites and history stay compatible with upstream.

## How the port works

- `shell.qml` makes the checkout a standalone Quickshell config. `import qs.Commons` resolves to
  `Commons/`, small stand-ins for omarchy-shell's style, color and utility singletons (colors from Qt's
  `SystemPalette`, fonts from the system font). `ui/BorderSurface.qml` and `ui/PointerMoveGate.qml`
  replace the two pieces used from `qs.Ui`.
- `services/AppFocuser.qml` uses `kdotool` instead of `hyprctl`; `services/OmarchyMenuSource.qml`
  reads `kde/menu.jsonc` plus your file; the submenu providers in `core/OmarchyMenu.js` call
  `plasma-apply-colorscheme`, `plasma-apply-lookandfeel` and `powerprofilesctl`.
- Window actions invoke KWin's own global-shortcut actions over D-Bus (`invokeShortcut`).
- `bin/plasmacast setup kde` writes a `.desktop` file with `X-KDE-Shortcuts` and frees the key from
  KRunner live through kglobalaccel's `setForeignShortcutKeys` (via `gdbus`).

The original omacast README is kept as [`README.omarchy.md`](README.omarchy.md).

## Development

```sh
node --test tests/*.test.js   # unit tests, no npm install
tests/smoke.sh                # live checks against the running instance
plasmacast restart            # Quickshell caches QML; restart after edits
plasmacast log
```

## Credits and license

Thanks to typecraft for omacast, which does the hard part. MIT, like omacast. `ui/PointerMoveGate.qml` and parts of `Commons/Util.qml` come from Omarchy's shell
(MIT). plasmacast, like omacast, is a clean-room project: it isn't affiliated with Raycast and contains
no Raycast code. It isn't affiliated with KDE e.V. either.
