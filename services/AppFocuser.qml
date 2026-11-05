import QtQuick
import Quickshell
import Quickshell.Io

// Opening an app that already has a window focuses that window instead of
// starting another instance [D]. On KDE the window list lives in KWin, which
// only scripts can read; kdotool (an xdotool look-alike built on KWin
// scripting) does that for us. Without kdotool, or when nothing matches,
// the app is launched as usual.
//
// The keys are the desktop id and StartupWMClass, lowercased. On Wayland,
// KWin's resourceClass is the client's app_id, which for well-behaved apps
// is the desktop id (org.kde.dolphin, firefox). kdotool matches
// case-insensitively.
Item {
  id: service
  property var pending: null
  signal launchRequested(var candidate)

  function open(candidate) {
    if (!candidate.windowKeys || !candidate.windowKeys.length) {
      service.launchRequested(candidate)
      return
    }
    if (service.pending) service.launchRequested(service.pending)
    service.pending = candidate
    focuser.running = false
    focuser.command = ["bash", "-c", service.script, "plasmacast-focus"].concat(candidate.windowKeys)
    focuser.running = true
  }

  // Exit 0: a window was activated. Anything else: launch. The keys arrive
  // as arguments (app ids, not user text) and are regex-escaped here.
  readonly property string script:
      'command -v kdotool >/dev/null || exit 3\n'
    + 're=""\n'
    + 'for k in "$@"; do\n'
    + '  [[ -z $k || $k == webapp:* ]] && continue\n'
    + '  e=$(printf "%s" "$k" | sed "s/[][\\\\.*^$+?(){}|\\/]/\\\\\\\\&/g")\n'
    + '  re+="${re:+|}$e"\n'
    + 'done\n'
    + '[[ -n $re ]] || exit 3\n'
    + 'id=$(kdotool search --class "^($re)$" 2>/dev/null | tail -n1)\n'
    + '[[ -n $id ]] || exit 1\n'
    + 'kdotool windowactivate "$id" >/dev/null 2>&1\n'

  Process {
    id: focuser
    onExited: function(exitCode) {
      var candidate = service.pending
      service.pending = null
      if (candidate && exitCode !== 0) service.launchRequested(candidate)
    }
  }
}
