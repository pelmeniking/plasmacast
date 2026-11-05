pragma Singleton
import QtQuick
import Quickshell

// KDE stand-in for the parts of omarchy-shell's Util that omacast uses.
// alpha/execDetached/execArgv/editsFilter/editedFilter are taken from
// Omarchy's shell/Commons/Util.qml (MIT, © David Heinemeier Hansson).
QtObject {
  function clampAlpha(value) {
    var n = Number(value)
    if (!isFinite(n)) return 1
    return Math.max(0, Math.min(1, n))
  }

  function alpha(c, opacity) {
    var a = clampAlpha(opacity)
    if (!c) return Qt.rgba(0, 0, 0, a)
    if (typeof c === "string") c = Qt.color(c)
    return Qt.rgba(c.r, c.g, c.b, a)
  }

  function fileUrl(path) {
    if (!path) return ""
    return "file://" + String(path).split("/").map(encodeURIComponent).join("/")
  }

  function shellQuote(value) {
    return "'" + String(value || "").replace(/'/g, "'\\''") + "'"
  }

  function execDetached(command) {
    Quickshell.execDetached(["bash", "-lc", command])
  }

  // argv without a shell interpreting it: `exec "$@"` keeps every argument
  // literal; the login shell keeps the session PATH.
  function execArgv(argv) {
    Quickshell.execDetached(["bash", "-lc", 'exec "$@"', "bash"].concat(argv))
  }

  function editsFilter(event, text) {
    if (!text) return false
    if (event.modifiers & (Qt.AltModifier | Qt.MetaModifier)) return false
    if (event.key === Qt.Key_U) return event.modifiers === Qt.ControlModifier
    return event.key === Qt.Key_Backspace
  }

  function editedFilter(event, text) {
    if (event.key === Qt.Key_U) return ""
    if (event.modifiers & Qt.ControlModifier) return text.replace(/\s+$/, "").replace(/\S+$/, "")
    return text.slice(0, -1)
  }
}
