import QtQuick
import Quickshell.Io

// Runs a typed shell command in the user's terminal (plasmacast's "Run in
// Terminal" fallback). Like ClipboardWriter, the command never travels on a
// command line of ours: it goes over stdin into an owner-only file that the
// terminal's shell reads and deletes. The terminal is the one set in System
// Settings › Default Applications (kdeglobals TerminalApplication), else
// Konsole.
//
// The command runs in an interactive login of $SHELL, so your aliases and
// PATH from ~/.zshrc or ~/.bashrc apply, and the window stays open in a
// normal shell afterwards. PLASMACAST_RUN=1 is set in that window, so an rc
// file can skip a banner such as fastfetch that would push the output away:
//   [[ -z $PLASMACAST_RUN ]] && fastfetch
Item {
  id: runner

  property var queued: null
  signal failed(string message)

  function run(command) {
    var text = String(command || "").trim()
    if (!text) return
    if (proc.running) { runner.queued = text; return }
    proc.text = text
    proc.stdinEnabled = true
    proc.running = true
  }

  // Constant script: the command arrives on stdin, nothing user-typed is in
  // argv. setsid -f detaches the terminal so this process ends at once.
  readonly property string script:
      'umask 077\n'
    + 'f=$(mktemp "${XDG_RUNTIME_DIR:-/tmp}/plasmacast-run.XXXXXXXX") || exit 1\n'
    + 'cat >"$f"\n'
    + 'term=$(kreadconfig6 --file kdeglobals --group General --key TerminalApplication 2>/dev/null)\n'
    + 'read -ra term <<<"${term:-konsole}"\n'
    + 'command -v "${term[0]}" >/dev/null || term=(konsole)\n'
    + 'sh=${SHELL:-/bin/bash}\n'
    + 'inner=\'c=$(cat "$1"); rm -f -- "$1"; printf "\\033[1m$ %s\\033[0m\\n" "$c"; eval "$c"; exec "$0" -i\'\n'
    + 'PLASMACAST_RUN=1 exec setsid -f "${term[@]}" -e "$sh" -i -c "$inner" "$sh" "$f"\n'

  Process {
    id: proc
    property string text: ""
    command: ["bash", "-c", runner.script]
    onStarted: {
      write(proc.text)
      proc.text = ""
      proc.stdinEnabled = false
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) runner.failed("Could not open a terminal")
      var next = runner.queued
      runner.queued = null
      if (next) runner.run(next)
    }
  }
}
