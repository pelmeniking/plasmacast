# omacast für KDE Plasma

Ein Raycast-artiger Launcher für **KDE Plasma 6 (Wayland)**. Das ist ein Fork von
[typecraft-dev/oma-cast](https://github.com/typecraft-dev/oma-cast), der ursprünglich nur als
Plugin in `omarchy-shell` unter Hyprland lief. Suche, Ranking (Port des Raycast-Algorithmus),
Frecency, Aliase, Favoriten, Rechner und Ctrl+K-Aktionspanel sind unverändert; geändert ist
alles, was an Omarchy und Hyprland hing. Die ursprüngliche Anleitung steht in
[`README.omarchy.md`](README.omarchy.md).

## Was anders ist als unter Omarchy

| | Omarchy | KDE-Fork |
|---|---|---|
| Läuft in | `omarchy-shell` als Plugin | eigener Quickshell-Instanz (`qs -p …/shell.qml`), gestartet von einem systemd-User-Service |
| Farben und Schrift | Omarchy-Theme | aktives Plasma-Farbschema und Systemschrift, live beim Umschalten |
| Aktionen | ~400 Einträge aus `omarchy-menu.jsonc` | KDE-Aktionen aus [`kde/menu.jsonc`](kde/menu.jsonc), dazu **alle Systemeinstellungs-Seiten** |
| Apps starten | `uwsm-app` / `gtk-launch` | `kstart --application` (wie Kickoff, mit eigenem systemd-Scope) |
| Offenes Fenster fokussieren | `hyprctl` | `kdotool` (optional) |
| Tastenkürzel | Hyprland `global` | KDE-Dienst-Kurzbefehl über kglobalaccel, Standard **Alt+Space** |
| HUD | Omarchy-OSD | Plasma-OSD |

### Die KDE-Aktionen

- **System:** Bildschirm sperren, Standby, Ruhezustand (nur wenn verfügbar), Abmelden, Neu starten,
  Herunterfahren (die letzten drei mit Rückfrage, über Plasmas eigenen Sitzungsdienst), Energieprofil,
  Plasma-Shell neu starten
- **Erscheinungsbild:** Dunkel/Hell umschalten, Farbschema und globales Design als Untermenü mit ✓ am
  aktuellen Eintrag, Nachtfarben umschalten
- **Fenster:** Übersicht, Rasteransicht, Fenster zeigen, Arbeitsfläche anzeigen, Fenster beenden
- **Bildschirmfoto** (Spectacle): Bereich, Bildschirm, alle Bildschirme, Fenster, Bereich aufnehmen
- **Systemeinstellungen:** jede Seite einzeln suchbar („Anzeige“, „Bluetooth“, „Kurzbefehle“ …), über
  die `kcm_*.desktop`-Einträge, die auch KRunner nutzt

Eigene Einträge legst du in `~/.config/omacast/menu.jsonc` an (im Launcher: „Edit omacast Menu“). Das
Format ist dasselbe wie in `kde/menu.jsonc`; gleiche IDs überschreiben, neue kommen dazu. Beispiel:

```jsonc
{
  "dev": {"iconName":"utilities-terminal","label":"Dev"},
  "dev.restart-docker": {"iconName":"view-refresh","label":"Docker neu starten","action":"pkexec systemctl restart docker"}
}
```

## Installation (CachyOS / Arch)

```sh
sudo pacman -S quickshell ttf-nerd-fonts-symbols wl-clipboard
paru -S kdotool            # optional: ↵ springt zu einem schon offenen Fenster
git clone <dieser Fork> ~/src/omacast
~/src/omacast/bin/omacast install     # systemd-User-Service + CLI nach ~/.local/bin
omacast setup kde                      # Alt+Space binden (fragt vorher)
omacast doctor
```

`omacast setup kde` zeigt an, was es ändert, und fragt nach. Alt+Space gehört in Plasma standardmäßig
KRunner; setup nimmt KRunner nur diese eine Taste weg (Alt+F2 bleibt) und merkt sich die alte Belegung.
Eine andere Taste: `omacast setup kde --key Meta+Space`. Danach steht omacast auch unter
*Systemeinstellungen › Tastatur › Kurzbefehle* und lässt sich dort ändern.

Optional:

- `ydotool` (mit laufendem `ydotoold`) oder `dotool`: „Paste Answer“ im Rechner fügt direkt ein.
  KWin erlaubt normalen Programmen keine virtuelle Tastatur, `wtype` geht unter Plasma also nicht.
- Rust (`cargo`): `omacast install` baut dann den schnelleren Such-Helfer aus `search/`.
- Umgebungsvariablen in `~/.config/systemd/user/omacast.service.d/override.conf`
  (`systemctl --user edit omacast`): `OMACAST_FONT`, `OMACAST_FONT_SIZE`, `OMACAST_RADIUS`,
  `OMACAST_OPACITY` (0.5–1).

### Entfernen

```sh
omacast uninstall      # Service, Kurzbefehl und CLI-Link weg, KRunner bekommt Alt+Space zurück
```

Deine Daten bleiben in `~/.config/omacast`, `~/.local/share/omacast`, `~/.cache/omacast` und
`~/.local/state/omacast`.

## CLI

```sh
omacast toggle | show | hide
omacast run <commandId>         # z. B. omarchy:system.lock, app:org.kde.dolphin
omacast call <method> [json]    # beliebige Backend-Methode
omacast restart | log | doctor
```

(Die IDs der Menüeinträge beginnen intern weiter mit `omarchy:`, damit Favoriten, Aliase und
Frecency mit dem Original kompatibel bleiben.)

## Tastatur

Wie im Original: `↵` / `Ctrl+↵` / `Ctrl+Shift+↵` für die erste bis dritte Aktion, `Ctrl+K`
Aktionspanel, `Ctrl+1…9` Treffer wählen, `↑` bei leerer Suche für den Verlauf, `Ctrl+↑/↓` zwischen
Abschnitten, `Ctrl+Shift+F` Favorit, `Esc` zurück, `Ctrl +/−/0` Zoom. Vollständige Liste in
[`README.omarchy.md`](README.omarchy.md#keyboard).

## Wie der Umbau aufgebaut ist

- `shell.qml` ist der Einstiegspunkt für Quickshell. `import qs.Commons` zeigt dort auf `Commons/`:
  kleine KDE-Ersatzteile für die Style-, Farb- und Hilfs-Singletons, die `omarchy-shell` sonst
  mitbringt (Farben aus `SystemPalette`, Schrift aus `Qt.application.font`). `ui/BorderSurface.qml`
  und `ui/PointerMoveGate.qml` ersetzen die zwei Bausteine aus `qs.Ui`.
- `services/AppFocuser.qml` nutzt `kdotool` statt `hyprctl`; `services/OmarchyMenuSource.qml` liest
  `kde/menu.jsonc` plus deine Datei; die Untermenü-Provider in `core/OmarchyMenu.js` rufen
  `plasma-apply-colorscheme`, `plasma-apply-lookandfeel` und `powerprofilesctl` auf.
- Fenster-Aktionen laufen über `org.kde.kglobalaccel … invokeShortcut`, also über dieselben Aktionen,
  die KWin für seine eigenen Tastenkürzel registriert.
- `bin/omacast` richtet Service und Kurzbefehl ein. Der Kurzbefehl ist eine `.desktop`-Datei mit
  `X-KDE-Shortcuts`; die KRunner-Umbelegung läuft live über `gdbus` und kglobalaccels
  `setForeignShortcutKeys`, eine Neuanmeldung ist nicht nötig.

## Entwicklung

```sh
node --test tests/*.test.js   # Unit-Tests, kein npm install nötig
tests/smoke.sh                # Live-Checks gegen die laufende Instanz
omacast restart               # Quickshell cached QML; nach Änderungen neu starten
omacast log
```

Lizenz MIT wie das Original. `ui/PointerMoveGate.qml` und Teile von `Commons/Util.qml` stammen aus
Omarchys Shell (MIT). omacast ist ein unabhängiges Clean-Room-Projekt ohne Verbindung zu Raycast.
