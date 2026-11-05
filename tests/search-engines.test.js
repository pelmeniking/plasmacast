const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const RS = require("../core/RootSearch.js")
const Schema = require("../core/Schema.js")
const Ranker = require("../core/Ranker.js")
const Frecency = require("../core/Frecency.js")
const OmarchyMenu = require("../core/OmarchyMenu.js")

const root = path.join(__dirname, "..")
const deps = { Ranker, Frecency, OmarchyMenu }
const DDG = { title: "DuckDuckGo", url: "https://duckduckgo.com/?q={query}", keywords: ["ddg"] }
const GOOGLE = { title: "Google", url: "https://www.google.com/search?q={query}" }

function fallbackTitles(engines, query) {
  const ctx = { commands: {}, frecency: {}, nowMs: Date.now(), executables: {}, fallbacks: RS.fallbacksFor(RS.searchEngines(engines)) }
  return RS.rootSections([], query || "wetter", ctx, deps)[0].rows.map((r) => r.candidate.title)
}

test("without searchEngines the defaults keep upstream's ids and order", () => {
  const engines = RS.searchEngines(null)
  assert.deepEqual(engines.map((e) => e.id), ["fallback:google", "fallback:duckduckgo"])
  assert.deepEqual(RS.builtinsFor(engines).map((b) => b.id), ["builtin:google-search", "builtin:duckduckgo-search", "builtin:calculator-history"])
  assert.deepEqual(fallbackTitles(null), ["Search Google", "Search DuckDuckGo", "Run in Terminal"])
})

test("the configured order is the fallback order", () => {
  assert.deepEqual(fallbackTitles([DDG, GOOGLE]), ["Search DuckDuckGo", "Search Google", "Run in Terminal"])
  assert.deepEqual(fallbackTitles([DDG]), ["Search DuckDuckGo", "Run in Terminal"])
  assert.deepEqual(fallbackTitles([]), ["Run in Terminal"], "an empty list leaves only the terminal")
  assert.deepEqual(fallbackTitles([DDG], "ls -la").slice(0, 1), ["Search DuckDuckGo"], "no executables known: web first")
})

test("fallback: false makes an engine a quicklink only", () => {
  const wiki = { title: "ArchWiki", url: "https://wiki.archlinux.org/index.php?search={query}", keywords: ["aw"], fallback: false }
  const engines = RS.searchEngines([DDG, wiki])
  assert.deepEqual(fallbackTitles([DDG, wiki]), ["Search DuckDuckGo", "Run in Terminal"])
  const quicklink = RS.builtinsFor(engines).find((b) => b.id === "builtin:archwiki-search")
  assert.equal(quicklink.title, "Search ArchWiki")
  assert.deepEqual(quicklink.keywords, ["aw"])
  assert.equal(RS.fillArguments(quicklink.run.url, { query: "pacman hooks" }), "https://wiki.archlinux.org/index.php?search=pacman%20hooks")
})

test("bad entries are skipped with a warning, the rest still work", () => {
  const warnings = []
  const engines = RS.searchEngines([
    "nope", { url: "https://x/?q={query}" }, { title: "No query", url: "https://x/" },
    { title: "Local", url: "file:///etc/passwd?{query}" }, DDG, { ...DDG, keywords: [] }
  ], (w) => warnings.push(w))
  assert.deepEqual(engines.map((e) => e.title), ["DuckDuckGo"])
  assert.equal(warnings.length, 5)
  assert.match(warnings.join("\n"), /\[0\] is not an object/)
  assert.match(warnings.join("\n"), /\[3\] \(Local\) needs an http\(s\) url/)
  assert.match(warnings.join("\n"), /\[5\] \(DuckDuckGo\) repeats/)
})

test("config.json accepts a searchEngines list and ignores other types", () => {
  assert.equal(Schema.withConfigDefaults({}).searchEngines, null)
  assert.deepEqual(Schema.withConfigDefaults({ searchEngines: [DDG] }).searchEngines, [DDG])
  assert.equal(Schema.withConfigDefaults({ searchEngines: "duckduckgo" }).searchEngines, null)
})

test("the example config spells out the defaults", () => {
  const example = JSON.parse(fs.readFileSync(path.join(root, "kde/config.example.json"), "utf8"))
  const fromExample = RS.searchEngines(Schema.withConfigDefaults(example).searchEngines)
  assert.deepEqual(fromExample.map((e) => [e.id, e.url, e.keywords]), RS.searchEngines(null).map((e) => [e.id, e.url, e.keywords]))
})

test("plasmacast config creates a private config.json from the example once", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "plasmacast-config-"))
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))
  const env = { HOME: home, XDG_CONFIG_HOME: home + "/.config", PATH: process.env.PATH }
  const run = () => spawnSync(path.join(root, "bin/plasmacast"), ["config", "--print-path"], { env, encoding: "utf8" })
  const r = run()
  assert.equal(r.status, 0, r.stderr)
  const file = home + "/.config/plasmacast/config.json"
  assert.match(r.stdout, /created .*config\.json/)
  assert.equal(fs.statSync(file).mode & 0o777, 0o600)
  assert.equal(fs.readFileSync(file, "utf8"), fs.readFileSync(path.join(root, "kde/config.example.json"), "utf8"))
  fs.writeFileSync(file, '{"searchEngines":[]}')
  assert.doesNotMatch(run().stdout, /created/)
  assert.equal(fs.readFileSync(file, "utf8"), '{"searchEngines":[]}', "an existing file is never overwritten")
})
