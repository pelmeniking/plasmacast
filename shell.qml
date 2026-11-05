//@ pragma UseQApplication
import QtQuick
import Quickshell

// Standalone entry point for KDE Plasma (and any other Wayland compositor
// with layer-shell). On Omarchy the plugin runs inside omarchy-shell; here
// Quickshell runs this directory as its own config:
//
//   qs -p /path/to/omacast
//
// qs.Commons resolves to ./Commons, the small KDE stand-ins for
// omarchy-shell's style singletons.
ShellRoot {
  Launcher {}
}
