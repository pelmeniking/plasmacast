import QtQuick
import qs.Commons

// KDE stand-in for omarchy-shell's BorderSurface: a Rectangle with a flat
// border taken from a Border spec.
Rectangle {
  id: root

  property var borderSpec: Border.none()

  readonly property real borderTop: Border.top(borderSpec)
  readonly property real borderRight: Border.right(borderSpec)
  readonly property real borderBottom: Border.bottom(borderSpec)
  readonly property real borderLeft: Border.left(borderSpec)

  border.color: Border.color(borderSpec)
  border.width: Border.uniformWidth(borderSpec)
}
