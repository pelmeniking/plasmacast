const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const Schema = require("../core/Schema.js")
const RootSearch = require("../core/RootSearch.js")

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8")

test("no problems means no toast", () => {
  assert.equal(Schema.problemSummary({ config: "", engines: [], menu: "" }), "")
  assert.equal(Schema.problemSummary(null), "")
})

test("a typo in config.json is named with the parser's message", () => {
  const text = Schema.problemSummary({ config: "Unexpected token } in JSON at position 42", engines: [], menu: "" })
  assert.equal(text, "config.json has an error and is ignored: Unexpected token } in JSON at position 42")
})

test("a broken search engine entry is reported with its own warning", () => {
  const warnings = []
  RootSearch.searchEngines([{ title: "YouTube", url: "youtube.com/results?q={query}" }], (w) => warnings.push(w))
  const text = Schema.problemSummary({ config: "", engines: warnings, menu: "" })
  assert.match(text, /^config\.json: searchEngines\[0\] \(YouTube\) needs an http\(s\) url/)
})

test("a broken menu.jsonc is reported", () => {
  assert.match(Schema.problemSummary({ menu: "Unexpected end of JSON input" }), /^menu\.jsonc has an error and is ignored: /)
})

test("several problems show the first and count the rest", () => {
  const text = Schema.problemSummary({ config: "bad", engines: ["a", "b"], menu: "worse" })
  assert.equal(text, "config.json has an error and is ignored: bad (+3 more, see plasmacast log)")
})

test("the backend records config and menu errors and clears them again", () => {
  const backend = read("Backend.qml")
  assert.match(backend, /backend\.configError = String\(e && e\.message \|\| e\)/)
  assert.equal(backend.match(/backend\.configError = ""/g).length, 2, "cleared on a good load and on a missing file")
  assert.match(backend, /menu: menuSource\.userError/)
  assert.match(read("services/OmarchyMenuSource.qml"), /source\.userError = parsed\.error/)
})

test("the launcher shows the problem as a failure toast when it opens", () => {
  const prepare = read("ui/LauncherWindow.qml").match(/function prepare\(payload\) \{[\s\S]*?\n  \}/)[0]
  assert.match(prepare, /window\.showToast\("failure", window\.backend\.problemSummary\)/)
})
