const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const RS = require("../core/RootSearch.js")
const Ranker = require("../core/Ranker.js")
const Frecency = require("../core/Frecency.js")
const OmarchyMenu = require("../core/OmarchyMenu.js")

const root = path.join(__dirname, "..")
const deps = { Ranker, Frecency, OmarchyMenu }
const ctx = (extra) => Object.assign({ commands: {}, frecency: {}, nowMs: Date.now(), executables: { ping: true, ls: true } }, extra)
const fallbackTitles = (query, c) => {
  const sections = RS.rootSections([], query, c || ctx(), deps)
  return sections.find((s) => s.id === "fallback-commands").rows.map((r) => r.candidate.title)
}

test("a query that starts with a command on PATH puts Run in Terminal first", () => {
  assert.deepEqual(fallbackTitles("ping -c3 1.1.1.1"), ["Run in Terminal", "Search Google", "Search DuckDuckGo"])
  const row = RS.rootSections([], "ping -c3 1.1.1.1", ctx(), deps)[0].rows[0].candidate
  assert.equal(row.command, "ping -c3 1.1.1.1")
})

test("plain words keep the web searches first and Run in Terminal last", () => {
  assert.deepEqual(fallbackTitles("wetter morgen"), ["Search Google", "Search DuckDuckGo", "Run in Terminal"])
  assert.deepEqual(fallbackTitles("ping -c3 1.1.1.1", ctx({ executables: null })), ["Search Google", "Search DuckDuckGo", "Run in Terminal"])
})

test("> forces a command: only the fallbacks show, terminal first, prefix stripped", () => {
  const sections = RS.rootSections(RS.BUILTINS.map(RS.builtinCandidate), "> calc", ctx(), deps)
  assert.deepEqual(sections.map((s) => s.id), ["fallback-commands"])
  assert.equal(sections[0].rows[0].candidate.title, "Run in Terminal")
  assert.equal(sections[0].rows[0].candidate.command, "calc")
  assert.equal(RS.forcedCommand(">  htop "), "htop")
  assert.equal(RS.forcedCommand("htop"), "")
})

test("Run in Terminal's info panel shows the command", () => {
  const rows = RS.aboutFor({ id: RS.TERMINAL_FALLBACK_ID, kind: "fallback", title: "Run in Terminal", typeLabel: "Fallback", terminal: true, command: "ls -la" }, Date.now())
  assert.ok(rows.some((r) => r.label === "Command" && r.value === "ls -la"), JSON.stringify(rows))
})

// The command goes over stdin into an owner-only file; a fake terminal
// records its argv and that of the shell it starts.
test("the typed command never appears on a command line and the temp file is gone", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plasmacast-terminal-"))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const log = path.join(dir, "log")
  fs.writeFileSync(path.join(dir, "konsole"), '#!/bin/bash\nprintf "%s\\n" "$*" >>"$LOG"\n[[ $1 == -e ]] && shift\n"$@" </dev/null >>"$LOG.out" 2>&1\n', { mode: 0o755 })
  fs.writeFileSync(path.join(dir, "kreadconfig6"), "#!/bin/bash\nexit 1\n", { mode: 0o755 })
  const source = fs.readFileSync(path.join(root, "services/TerminalRunner.qml"), "utf8")
  const expr = source.match(/readonly property string script:\n([\s\S]*?)\n\n/)[1]
  const script = new Function("return " + expr)()
  const secret = 'echo "private-$((6*7))"'
  const r = spawnSync("bash", ["-c", script], {
    input: secret, encoding: "utf8",
    env: { ...process.env, LOG: log, SHELL: "/bin/bash", XDG_RUNTIME_DIR: dir, PATH: dir + ":" + process.env.PATH }
  })
  assert.equal(r.status, 0, r.stderr)
  for (let i = 0; i < 50 && !fs.existsSync(log + ".out"); i++) spawnSync("sleep", ["0.05"])
  spawnSync("sleep", ["0.3"])
  const argv = fs.readFileSync(log, "utf8")
  assert.doesNotMatch(argv, /private/, "the command is not in the terminal's argv")
  assert.match(fs.readFileSync(log + ".out", "utf8"), /private-42/, "the shell ran it")
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.startsWith("plasmacast-run.")), [], "the command file is removed")
})
