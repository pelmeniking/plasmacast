const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const focus = path.join(__dirname, "..", "bin/plasmacast-focus")

// A fake busctl that answers like KWin: /WindowsRunner Match returns every
// window whose title or class contains the term (as busctl prints
// a(sssida{sv})), /KWin getWindowInfo returns the window's a{sv}, and Run
// records the activated id. Windows are "uuid|class|desktopFile|title".
function fakeKwin(t, windows, { broken = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plasmacast-focus-"))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.mkdirSync(path.join(dir, "bin"))
  fs.writeFileSync(path.join(dir, "windows"), windows.join("\n") + "\n")
  fs.writeFileSync(path.join(dir, "bin/busctl"), `#!/bin/bash
${broken ? "echo 'Call failed: The name is not activatable' >&2; exit 1" : ""}
dir=${JSON.stringify(dir)}
shift 4  # --user call org.kde.KWin <path>
iface=$1 method=$2 sig=$3; shift 3
echo "$method $*" >>"$dir/calls"
case $method in
  Match)
    out=""; n=0
    while IFS='|' read -r uuid class file title; do
      [[ -z $uuid ]] && continue
      if [[ \${title,,} == *"\${1,,}"* || \${class,,} == *"\${1,,}"* ]]; then
        out+=" \\"0_{$uuid}\\" \\"$title\\" \\"icon\\" 100 0.8 1 \\"subtext\\" s \\"Activate running window\\""; n=$((n+1))
      fi
    done <"$dir/windows"
    echo "a(sssida{sv}) $n$out" ;;
  getWindowInfo)
    while IFS='|' read -r uuid class file title; do
      if [[ "{$uuid}" == "$1" ]]; then
        echo "a{sv} 4 \\"caption\\" s \\"$title\\" \\"desktopFile\\" s \\"$file\\" \\"resourceClass\\" s \\"$class\\" \\"uuid\\" s \\"{$uuid}\\""
        exit 0
      fi
    done <"$dir/windows"
    echo "a{sv} 0" ;;
  Run) echo "$1" >"$dir/activated" ;;
  *) echo "unexpected $method" >&2; exit 1 ;;
esac
`, { mode: 0o755 })
  const env = { ...process.env, PATH: path.join(dir, "bin") + ":" + process.env.PATH }
  const run = (...keys) => spawnSync(focus, keys, { env, encoding: "utf8" })
  const activated = () => fs.existsSync(path.join(dir, "activated")) ? fs.readFileSync(path.join(dir, "activated"), "utf8").trim() : null
  return { run, activated }
}

test("focuses the open window whose class is the app's key", (t) => {
  const kwin = fakeKwin(t, [
    "aaaa-1|org.kde.konsole|org.kde.konsole|Notes about org.kde.dolphin",
    "bbbb-2|org.kde.dolphin|org.kde.dolphin|Home — Dolphin"
  ])
  const r = kwin.run("org.kde.dolphin")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(kwin.activated(), "0_{bbbb-2}")
})

test("matches the class without caring about case", (t) => {
  const kwin = fakeKwin(t, ["cccc-3|Steam|steam|Steam"])
  const r = kwin.run("steam")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(kwin.activated(), "0_{cccc-3}")
})

test("a window whose title merely mentions the app is not focused", (t) => {
  const kwin = fakeKwin(t, ["dddd-4|org.kde.konsole|org.kde.konsole|firefox --help"])
  const r = kwin.run("firefox")
  assert.equal(r.status, 1)
  assert.equal(kwin.activated(), null)
})

test("tries every key, e.g. StartupWMClass after the desktop id", (t) => {
  const kwin = fakeKwin(t, ["eeee-5|code|code-oss|main.go - Code"])
  const r = kwin.run("visual-studio-code", "code")
  assert.equal(r.status, 0, r.stderr)
  assert.equal(kwin.activated(), "0_{eeee-5}")
})

test("no open window means launch (exit 1)", (t) => {
  const kwin = fakeKwin(t, [])
  assert.equal(kwin.run("org.kde.dolphin").status, 1)
})

test("when KWin can't be asked, plasmacast launches instead (exit 3)", (t) => {
  const kwin = fakeKwin(t, ["ffff-6|org.kde.dolphin|org.kde.dolphin|Home"], { broken: true })
  assert.equal(kwin.run("org.kde.dolphin").status, 3)
  assert.equal(kwin.activated(), null)
})

test("web app and empty keys are skipped", (t) => {
  const kwin = fakeKwin(t, ["gggg-7|chromium|chromium|YouTube"])
  assert.equal(kwin.run("", "webapp:youtube").status, 3)
  assert.equal(kwin.activated(), null)
})
