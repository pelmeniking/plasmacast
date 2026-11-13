import QtQuick
import Quickshell
import Quickshell.Io

// Opening an app that already has a window focuses that window instead of
// starting another instance [D]. On KDE the window list lives in KWin;
// bin/plasmacast-focus asks it over D-Bus (no kdotool needed). When KWin
// can't be asked, or nothing matches, the app is launched as usual.
//
// The keys are the desktop id and StartupWMClass, lowercased. On Wayland,
// KWin's resourceClass is the client's app_id, which for well-behaved apps
// is the desktop id (org.kde.dolphin, firefox). Matching ignores case.
Item {
  id: service
  property var pending: null
  // Standalone (KDE) runs serve QML as qs:@/… URLs; see OmarchyMenuSource.
  property string executable: {
    var url = Qt.resolvedUrl("../bin/plasmacast-focus").toString()
    return /^file:\/\//.test(url) ? decodeURIComponent(url.slice(7)) : Quickshell.shellPath("bin/plasmacast-focus")
  }
  signal launchRequested(var candidate)

  function open(candidate) {
    if (!candidate.windowKeys || !candidate.windowKeys.length) {
      service.launchRequested(candidate)
      return
    }
    if (service.pending) service.launchRequested(service.pending)
    service.pending = candidate
    focuser.running = false
    focuser.command = [service.executable].concat(candidate.windowKeys)
    focuser.running = true
  }

  // Exit 0: a window was activated. Anything else: launch.
  Process {
    id: focuser
    onExited: function(exitCode) {
      var candidate = service.pending
      service.pending = null
      if (candidate && exitCode !== 0) service.launchRequested(candidate)
    }
  }
}
