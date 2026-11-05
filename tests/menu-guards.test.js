const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const OmarchyMenu = require("../core/OmarchyMenu.js")

const sourcePath = path.join(__dirname, "../services/OmarchyMenuSource.qml")
const text = fs.readFileSync(sourcePath, "utf8")
const methods = ["guardItems", "compileGuards", "guardKeys", "finishGuards", "refresh"]

// QML block sample: "  function refresh() {\n  }".
function block(signature, indentation) {
  const start = text.indexOf(signature)
  assert.ok(start >= 0, signature)
  const open = text.indexOf("{", start)
  const end = text.indexOf("\n" + " ".repeat(indentation) + "}", open) + indentation + 2
  assert.ok(end > open, signature)
  return text.slice(start, end)
}

function method(name) {
  return block("function " + name + "(", 2)
}

function sampleTree() {
  return OmarchyMenu.buildTree(OmarchyMenu.parse(JSON.stringify({
    probe: { when: "true", checked: "false", disabled: "custom-check --literal '*'" },
    other: { when: "false" }
  })).items, [])
}

// KDE has no OEM guard compiler (Omarchy's MenuModel.js), so guards always
// come from OmarchyMenu.guardScript.
function harness() {
  const messages = []
  const source = {
    guardCompiler: null, tree: sampleTree(), guards: { previous: true }, revision: 7,
    message: (...args) => messages.push(args), providerMenus: () => [], startNextProvider() {}
  }
  const guardProc = { running: false, collected: "", requestTree: null, expectedGuards: [] }
  const context = vm.createContext({
    source, guardProc, providerProc: { running: true }, OmarchyMenu
  })
  for (const name of methods) {
    vm.runInContext(method(name), context)
    source[name] = context[name]
  }
  return {
    source, guardProc, messages,
    start() {
      vm.runInContext(text.match(/Component.onCompleted: ([^\n]+)/)[1], context)
    },
    exit(code, status = 0, output = "probe:w:1\nprobe:c:0\nprobe:d:1\nother:w:0\n") {
      guardProc.running = false
      guardProc.collected = output
      Object.assign(context, { exitCode: code, exitStatus: status })
      const handler = block("onExited: function(exitCode, exitStatus)", 4)
      vm.runInContext("(" + handler.slice(handler.indexOf("function")) + ")(exitCode, exitStatus)", context)
    }
  }
}

test("startup compiles guards with the built-in script", () => {
  const h = harness()
  h.start()
  assert.equal(h.source.guardCompiler, null)
  assert.deepEqual(Array.from(h.guardProc.command), ["bash", "-lc", OmarchyMenu.guardScript(h.source.tree)])
  assert.deepEqual(Array.from(h.guardProc.expectedGuards), ["probe:w", "probe:c", "probe:d", "other:w"])
})

test("only successful complete guard responses publish once", () => {
  const h = harness()
  h.start()
  h.exit(0)
  assert.deepEqual(h.source.guards, { when: { probe: true, other: false }, checked: { probe: false }, disabled: { probe: true } })
  assert.equal(h.source.revision, 8)
  assert.deepEqual(h.messages, [])
  h.exit(0)
  assert.equal(h.source.revision, 8)
})

test("nonzero exit or abnormal termination retains previous guards and warns once", () => {
  for (const [code, status] of [[1, 0], [0, 1], [9, 1]]) {
    const h = harness()
    const previous = h.source.guards
    h.start()
    h.exit(code, status)
    assert.equal(h.source.guards, previous)
    assert.equal(h.source.revision, 7)
    assert.equal(h.messages.length, 1)
    assert.equal(h.messages[0][0], "warning")
    assert.match(h.messages[0][1], /refresh failed/)
  }
})

test("exit zero with missing or malformed rows retains previous guards", () => {
  const rows = ["probe:w:1", "probe:c:0", "probe:d:1", "other:w:0"]
  for (let missing = 0; missing < rows.length; missing++) {
    const h = harness()
    const previous = h.source.guards
    h.start()
    h.exit(0, 0, [...rows.filter((row, i) => i !== missing), rows[(missing + 1) % rows.length], "probe:d:2", "bad id:w:1"].join("\n"))
    assert.equal(h.source.guards, previous)
    assert.equal(h.source.revision, 7)
    assert.equal(h.messages.length, 1)
    assert.match(h.messages[0][1], /incomplete/)
  }
  const empty = harness()
  const previous = empty.source.guards
  empty.start()
  empty.exit(0, 0, "")
  assert.equal(empty.source.guards, previous)
})

test("expected tags are captured per request rather than read from changed guard fields", () => {
  const h = harness()
  const previous = h.source.guards
  h.start()
  h.source.tree.items.probe.disabled = ""
  h.exit(0, 0, "probe:w:1\nprobe:c:0\nother:w:0\n")
  assert.equal(h.source.guards, previous)
  assert.match(h.messages[0][1], /incomplete/)
})

test("a response for an old tree is discarded and the current tree is refreshed", () => {
  const h = harness()
  const previous = h.source.guards
  h.start()
  const requested = h.guardProc.requestTree
  h.source.tree = OmarchyMenu.buildTree(OmarchyMenu.parse('{"latest":{"checked":"true"}}').items, [])
  h.source.refresh()
  assert.equal(h.guardProc.requestTree, requested)
  h.exit(0)
  assert.equal(h.source.guards, previous)
  assert.equal(h.source.revision, 7)
  assert.equal(h.guardProc.requestTree, h.source.tree)
  assert.deepEqual(Array.from(h.guardProc.expectedGuards), ["latest:c"])
  assert.equal(h.guardProc.running, true)
  h.exit(0, 0, "latest:c:1\n")
  assert.deepEqual(h.source.guards, { when: {}, checked: { latest: true }, disabled: {} })
  assert.equal(h.source.revision, 8)
})

test("empty guard scripts do not launch a process", () => {
  const h = harness()
  h.source.tree = OmarchyMenu.buildTree([], [])
  h.start()
  assert.equal(h.guardProc.running, false)
  assert.equal(h.guardProc.requestTree, null)
})
