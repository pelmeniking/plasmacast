pragma Singleton
import QtQuick

// KDE stand-in for omarchy-shell's Border singleton: a flat, uniform border
// is all plasmacast draws, so a spec is just { color, widths }.
QtObject {
  function make(color, width) {
    var w = Math.max(0, Number(width) || 0)
    return { color: color, widths: { top: w, right: w, bottom: w, left: w } }
  }

  function none() { return make("transparent", 0) }

  function surfaceSpec(section, token, fallbackColor, fallbackWidth) {
    return make(fallbackColor, Math.max(1, Math.round(Number(fallbackWidth) / 2) || 1))
  }

  function needsOverlay(spec) { return false }
  function canUseNative(spec) { return true }
  function top(spec) { return spec && spec.widths ? spec.widths.top : 0 }
  function right(spec) { return spec && spec.widths ? spec.widths.right : 0 }
  function bottom(spec) { return spec && spec.widths ? spec.widths.bottom : 0 }
  function left(spec) { return spec && spec.widths ? spec.widths.left : 0 }
  function uniformWidth(spec) { return top(spec) }
  function color(spec) { return spec ? spec.color : "transparent" }
}
