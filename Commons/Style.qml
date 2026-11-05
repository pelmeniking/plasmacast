pragma Singleton
import QtQuick
import Quickshell

// KDE stand-in for omarchy-shell's Style singleton: only the tokens plasmacast
// uses. Omarchy reads them from Hyprland and its theme; on Plasma they follow
// the system font from System Settings → Text & Fonts, so plasmacast grows and
// shrinks with the rest of the desktop.
//
// Environment overrides (set them in the systemd unit or your session):
//   PLASMACAST_FONT       family for all launcher text (default: Plasma's UI font)
//   PLASMACAST_FONT_SIZE  base size in px; every other size derives from it
//   PLASMACAST_RADIUS     corner radius in px (default 8, Breeze-like)
QtObject {
  id: root

  function envNumber(name, fallback) {
    var n = Number(Quickshell.env(name))
    return isFinite(n) && n > 0 ? n : fallback
  }

  // Plasma's default 10pt Noto Sans is ~13px; Omarchy's base is 12px.
  readonly property int systemFontPx: {
    var f = Qt.application.font
    if (f.pixelSize > 0) return f.pixelSize
    if (f.pointSize > 0) return Math.round(f.pointSize * 4 / 3)
    return 13
  }

  property int fontBaseSize: Math.max(10, Math.min(24, Math.round(envNumber("PLASMACAST_FONT_SIZE", systemFontPx))))
  readonly property real fontScale: fontBaseSize / 12

  property int cornerRadius: Math.round(envNumber("PLASMACAST_RADIUS", 8))
  property int gapsOut: 8

  function fontPx(mult) { return Math.max(1, Math.round(fontBaseSize * mult)) }

  function spaceReal(px) {
    var n = Number(px)
    if (!isFinite(n) || n <= 0) return 0
    return n * fontScale
  }

  function space(px) {
    var n = spaceReal(px)
    if (n <= 0) return 0
    return Math.max(1, Math.round(n))
  }

  readonly property QtObject spacing: QtObject {
    readonly property int hairline: root.space(1)
  }

  readonly property string uiFontFamily: {
    var override = Quickshell.env("PLASMACAST_FONT")
    return override && override.length > 0 ? override : (Qt.application.font.family || "sans-serif")
  }

  readonly property QtObject font: QtObject {
    readonly property string family: root.uiFontFamily
    readonly property string menuFamily: root.uiFontFamily
    // UI glyphs (arrows, stars, search) are Nerd Font code points. Text uses
    // the Plasma font and fontconfig falls back to this family for glyphs.
    readonly property string iconFamily: "Symbols Nerd Font"
    readonly property int baseSize: root.fontBaseSize
    readonly property int caption:   root.fontPx(0.833)
    readonly property int bodySmall: root.fontPx(0.917)
    readonly property int body:      root.fontPx(1.0)
    readonly property int subtitle:  root.fontPx(1.083)
    readonly property int title:     root.fontPx(1.167)
    readonly property int heading:   root.fontPx(1.333)
  }
}
