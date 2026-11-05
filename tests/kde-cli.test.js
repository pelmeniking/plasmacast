const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const root = path.join(__dirname, "..")
const cli = path.join(root, "bin/plasmacast")
const ALT_SPACE = 134217760
const ALT_F2 = 150994993
const SEARCH = 16777399

// A fake kglobalaccel: gdbus answers from one state file per component,
// the way org.kde.KGlobalAccel replies (a(ai) of 4-int key sequences).
// kbuildsycoca6 registers plasmacast.desktop with its X-KDE-Shortcuts default
// when the key is free, as kglobalacceld does on a ksycoca change.
function fakeKde(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "plasmacast-kde-cli-"))
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))
  const bin = path.join(home, "bin")
  const state = path.join(home, "kga")
  fs.mkdirSync(bin)
  fs.mkdirSync(state)
  fs.writeFileSync(path.join(state, "org.kde.krunner.desktop"), [ALT_SPACE, ALT_F2, SEARCH].join("\n") + "\n")
  const tool = (name, body) => fs.writeFileSync(path.join(bin, name), "#!/bin/bash\n" + body, { mode: 0o755 })
  tool("gdbus", `
state=${JSON.stringify(state)}
method=""; args=()
while (( $# )); do case $1 in --method) method=\${2##*.}; shift ;; --session|call) ;; --dest|--object-path) shift ;; *) args+=("$1") ;; esac; shift; done
comp() { grep -oE "^\\['[^']*'" <<<"$1" | tr -d "['"; }
variant() { local out=""; while read -r c; do [[ -n $c ]] && out+="\${out:+, }([$c, 0, 0, 0],)"; done; echo "([$out],)"; }
case $method in
  allMainComponents) echo "([['org.kde.krunner.desktop', 'KRunner', '', '']],)" ;;
  actionList)
    code=$(grep -oE '[0-9]+' <<<"\${args[0]}" | head -1)
    for f in "$state"/*; do grep -qx "$code" "$f" && { echo "(['$(basename "$f")', '_launch', 'x', 'x'],)"; exit; }; done
    echo "(@as [],)" ;;
  shortcutKeys) f="$state/$(comp "\${args[0]}")"; [[ -f $f ]] || { echo "Error: no such action" >&2; exit 1; }; variant <"$f" ;;
  setForeignShortcutKeys) f="$state/$(comp "\${args[0]}")"; [[ -f $f ]] || exit 0; grep -oE '\\(\\[[0-9]+' <<<"\${args[1]}" | tr -d '([' >"$f"; echo "()" ;;
  *) echo "unexpected $method" >&2; exit 1 ;;
esac
`)
  tool("kbuildsycoca6", `
[[ -f $XDG_DATA_HOME/applications/omacast.desktop ]] || rm -f ${JSON.stringify(state)}/omacast.desktop
desktop="$XDG_DATA_HOME/applications/plasmacast.desktop"; f=${JSON.stringify(state)}/plasmacast.desktop
if [[ ! -f $desktop ]]; then rm -f "$f"; exit 0; fi
[[ -f $f ]] && exit 0
grep -m1 '^Exec=' "$desktop" >"$f.exec"
grep -qx ${ALT_SPACE} ${JSON.stringify(state)}/* 2>/dev/null && { : >"$f"; exit 0; }
echo ${ALT_SPACE} >"$f"
`)
  tool("qs", "exit 0\n")
  tool("systemctl", "exit 0\n")
  const env = {
    HOME: home, XDG_CONFIG_HOME: home + "/.config", XDG_DATA_HOME: home + "/.local/share",
    PATH: bin + ":" + process.env.PATH
  }
  const run = (...args) => spawnSync(cli, args, { env, encoding: "utf8" })
  const loadedExec = () => fs.readFileSync(path.join(state, "plasmacast.desktop.exec"), "utf8").trim()
  const keys = (component) => fs.readFileSync(path.join(state, component), "utf8").split("\n").filter(Boolean).map(Number)
  return { home, env, run, keys, state, loadedExec }
}

test("setup kde takes Alt+Space from KRunner, binds plasmacast, and uninstall gives it back", (t) => {
  const kde = fakeKde(t)
  const r = kde.run("setup", "kde", "--yes")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /Alt\+Space toggles plasmacast/)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_F2, SEARCH])
  assert.deepEqual(kde.keys("plasmacast.desktop"), [ALT_SPACE])

  const desktop = fs.readFileSync(kde.home + "/.local/share/applications/plasmacast.desktop", "utf8")
  assert.match(desktop, /^X-KDE-Shortcuts=Alt\+Space$/m)
  assert.match(desktop, /^NoDisplay=true$/m)
  assert.match(desktop, new RegExp('^Exec="[^"]*/qs" ipc -p "' + root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/shell.qml" call plasmacast toggle$', "m"))

  const again = kde.run("setup", "kde", "--yes")
  assert.equal(again.status, 0, again.stdout + again.stderr)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_F2, SEARCH])

  const u = kde.run("uninstall", "--yes")
  assert.equal(u.status, 0, u.stdout + u.stderr)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_SPACE, ALT_F2, SEARCH])
  assert.ok(!fs.existsSync(kde.home + "/.local/share/applications/plasmacast.desktop"))
  assert.ok(!fs.existsSync(kde.home + "/.config/plasmacast/krunner-shortcut"))
})

test("setup kde refuses a key another app owns and leaves everything alone", (t) => {
  const kde = fakeKde(t)
  fs.writeFileSync(path.join(kde.state, "org.kde.konsole.desktop"), "268435488\n")
  const r = kde.run("setup", "kde", "--key", "Meta+Space", "--yes")
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /already used by org\.kde\.konsole\.desktop/)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_SPACE, ALT_F2, SEARCH])
  assert.ok(!fs.existsSync(kde.home + "/.local/share/applications/plasmacast.desktop"))
})

test("setup kde with a free key doesn't touch KRunner", (t) => {
  const kde = fakeKde(t)
  const r = kde.run("setup", "kde", "--key", "Ctrl+Alt+K", "--yes")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_SPACE, ALT_F2, SEARCH])
  // The fake only auto-registers Alt+Space, so this exercises the explicit set.
  assert.deepEqual(kde.keys("plasmacast.desktop"), [201326667])
})

test("setup kde never changes anything without confirmation", (t) => {
  const kde = fakeKde(t)
  const r = spawnSync(cli, ["setup", "kde"], { env: kde.env, encoding: "utf8", input: "" })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /pass --yes/)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_SPACE, ALT_F2, SEARCH])
})

test("install writes a systemd user unit that runs this checkout's shell.qml", (t) => {
  const kde = fakeKde(t)
  // The fake qs answers "ok" to ping so install sees the instance come up.
  fs.writeFileSync(path.join(kde.home, "bin/qs"), '#!/bin/bash\n[[ " $* " == *" ping "* ]] && echo ok\nexit 0\n', { mode: 0o755 })
  const env = { ...kde.env, PATH: kde.env.PATH.split(":").filter((p) => !/cargo/.test(p)).join(":") }
  const r = spawnSync(cli, ["install"], { env, encoding: "utf8" })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const unit = fs.readFileSync(kde.home + "/.config/systemd/user/plasmacast.service", "utf8")
  assert.match(unit, /^ExecStart="[^"]*\/qs" -p ".*\/shell\.qml"$/m)
  assert.match(unit, /^WantedBy=graphical-session\.target$/m)
  assert.equal(fs.readlinkSync(kde.home + "/.local/bin/plasmacast"), cli)
})

test("rerunning setup kde after the checkout moved makes KDE load the new Exec line", (t) => {
  const kde = fakeKde(t)
  assert.equal(kde.run("setup", "kde", "--yes").status, 0)
  const file = kde.home + "/.local/share/applications/plasmacast.desktop"
  // What KDE loaded first; simulate a desktop file written from another path.
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/^Exec=.*$/m, 'Exec="/usr/bin/qs" ipc -p "/old/place/shell.qml" call plasmacast toggle'))
  fs.rmSync(path.join(kde.state, "plasmacast.desktop"))
  spawnSync(path.join(kde.home, "bin/kbuildsycoca6"), [], { env: kde.env })
  assert.match(kde.loadedExec(), /old\/place/)
  const r = kde.run("setup", "kde", "--yes")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(kde.loadedExec(), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/shell\\.qml"))
  assert.deepEqual(kde.keys("plasmacast.desktop"), [ALT_SPACE])
})

test("an install under the old omacast name is replaced: service, CLI link and shortcut", (t) => {
  const kde = fakeKde(t)
  // What `omacast install` and `omacast setup kde` left behind.
  const apps = kde.home + "/.local/share/applications"
  fs.mkdirSync(apps, { recursive: true })
  fs.writeFileSync(apps + "/omacast.desktop", "[Desktop Entry]\nExec=old\nX-KDE-Shortcuts=Alt+Space\n")
  fs.writeFileSync(path.join(kde.state, "org.kde.krunner.desktop"), [ALT_F2, SEARCH].join("\n") + "\n")
  fs.writeFileSync(path.join(kde.state, "omacast.desktop"), ALT_SPACE + "\n")
  fs.mkdirSync(kde.home + "/.config/omacast", { recursive: true })
  fs.writeFileSync(kde.home + "/.config/omacast/krunner-shortcut", [ALT_SPACE, ALT_F2, SEARCH].join("\n") + "\n")
  fs.mkdirSync(kde.home + "/.config/systemd/user", { recursive: true })
  fs.writeFileSync(kde.home + "/.config/systemd/user/omacast.service", "[Service]\n")
  fs.mkdirSync(kde.home + "/.local/bin", { recursive: true })
  fs.symlinkSync("/gone/oma-cast/bin/omacast", kde.home + "/.local/bin/omacast")
  fs.writeFileSync(path.join(kde.home, "bin/qs"), '#!/bin/bash\n[[ " $* " == *" ping "* ]] && echo ok\nexit 0\n', { mode: 0o755 })

  const env = { ...kde.env, PATH: kde.env.PATH.split(":").filter((p) => !/cargo/.test(p)).join(":") }
  const i = spawnSync(cli, ["install"], { env, encoding: "utf8" })
  assert.equal(i.status, 0, i.stdout + i.stderr)
  assert.ok(!fs.existsSync(kde.home + "/.config/systemd/user/omacast.service"))
  assert.equal(fs.lstatSync(kde.home + "/.local/bin/omacast", { throwIfNoEntry: false }), undefined, "the dangling omacast link is gone")
  assert.equal(fs.readlinkSync(kde.home + "/.local/bin/plasmacast"), cli)

  const r = kde.run("setup", "kde", "--yes")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /remove the old omacast shortcut/)
  assert.ok(!fs.existsSync(apps + "/omacast.desktop"))
  assert.deepEqual(kde.keys("plasmacast.desktop"), [ALT_SPACE])
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_F2, SEARCH], "KRunner isn't touched again")
  assert.ok(fs.existsSync(kde.home + "/.config/plasmacast/krunner-shortcut"), "the KRunner backup comes along")

  const u = kde.run("uninstall", "--yes")
  assert.equal(u.status, 0, u.stdout + u.stderr)
  assert.deepEqual(kde.keys("org.kde.krunner.desktop"), [ALT_SPACE, ALT_F2, SEARCH])
})
