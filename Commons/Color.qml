pragma Singleton
import QtQuick
import Quickshell

// KDE stand-in for omarchy-shell's Color singleton. The colors come from the
// active Plasma color scheme through Qt's palette (plasma-integration sets it
// for every Qt app), so plasmacast follows Breeze Light/Dark and custom schemes,
// and updates live when you switch.
//
// PLASMACAST_OPACITY (0.5–1, default 1) makes the card translucent.
QtObject {
  id: root

  property SystemPalette palette: SystemPalette { colorGroup: SystemPalette.Active }

  readonly property real opacity: {
    var n = Number(Quickshell.env("PLASMACAST_OPACITY"))
    return isFinite(n) && n >= 0.5 && n <= 1 ? n : 1
  }

  function withAlpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }

  readonly property color background: palette.window
  readonly property color foreground: palette.windowText
  readonly property color accent: palette.highlight

  readonly property QtObject menu: QtObject {
    property color background: root.withAlpha(root.palette.window, root.opacity)
    property color text: root.palette.windowText
    property color border: root.withAlpha(root.palette.windowText, 0.18)
    property color scrim: root.withAlpha(root.palette.window, 0.5)
    property color selectedBackground: root.withAlpha(root.palette.highlight, 0.22)
    // The accent is used for selected titles and icons, so on very light
    // highlight colors the plain text color reads better.
    property color selectedText: root.palette.highlight.hslLightness > 0.75 ? root.palette.windowText : root.palette.highlight
  }
}
