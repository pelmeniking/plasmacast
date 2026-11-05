# plasmacast

**A Raycast-style launcher for KDE Plasma 6 (Wayland).** It learns what you use, searches your apps,
every System Settings page and a set of Plasma actions, and follows your color scheme.

plasmacast is a fork of [omacast](https://github.com/typecraft-dev/oma-cast) by typecraft, which is
built for [Omarchy](https://omarchy.org) and runs inside `omarchy-shell` on Hyprland. The search, the
ranking (a port of Raycast's root-search algorithm with frecency and learned search terms), aliases,
favorites, the calculator and the Ctrl+K action panel are omacast's. plasmacast replaces everything that
depended on Omarchy and Hyprland. The port was written with Claude (Anthropic) and is tested on
CachyOS with Plasma 6.

> **Status: personal project, provided as is.** It works on my machine. Issues are welcome, but I
> can't promise fixes or a schedule. plasmacast is not an official KDE project.

## What it does on Plasma

- **Apps** start through `kstart`, like Kickoff. With [`kdotool`](https://github.com/jinliu/kdotool)
  installed, ↵ switches to an app's open window instead of starting another one (Shift+↵ always opens new).
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
git clone https://github.com/<you>/plasmacast ~/repos/plasmacast
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

### Coming from the omacast KDE port

`plasmacast install` removes the old `omacast` service and CLI link, `plasmacast setup kde` replaces the
old shortcut, and your history, favorites and aliases move from `omacast` to `plasmacast` on first start.

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

## License

MIT, like omacast. `ui/PointerMoveGate.qml` and parts of `Commons/Util.qml` come from Omarchy's shell
(MIT). plasmacast, like omacast, is a clean-room project: it isn't affiliated with Raycast and contains
no Raycast code. It isn't affiliated with KDE e.V. either.
