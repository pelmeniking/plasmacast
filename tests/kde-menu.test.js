const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const vm = require("node:vm")
const { execFileSync } = require("node:child_process")
const OmarchyMenu = require("../core/OmarchyMenu.js")
const RootSearch = require("../core/RootSearch.js")
const Ranker = require("../core/Ranker.js")
const Frecency = require("../core/Frecency.js")

const deps = { OmarchyMenu, Ranker, Frecency }
const root = path.join(__dirname, "..")
const backendSource = fs.readFileSync(path.join(root, "Backend.qml"), "utf8")
const parsed = OmarchyMenu.parse(fs.readFileSync(path.join(root, "kde/menu.jsonc"), "utf8"))
const tree = OmarchyMenu.buildTree(parsed.items, [])

function backendFunction(name, params, context) {
  const signature = "function " + name + "(" + params + ")"
  const start = backendSource.indexOf(signature)
  assert.ok(start >= 0, signature)
  const end = backendSource.indexOf("\n  }", start) + 4
  return vm.runInContext("(" + backendSource.slice(start, end) + ")", context)
}

function harness(menuTree) {
  const shell = []
  const candidates = RootSearch.menuCandidates(menuTree, {}, {}, deps)
  const backend = {
    decorated: id => candidates.find(c => c.id === id),
    recordVisit() {},
    runShell: command => shell.push(command),
    summonPlugin: () => { throw new Error("KDE has no plugins to summon") }
  }
  const context = vm.createContext({ backend, menuSource: { tree: menuTree }, OmarchyMenu })
  backend.openMenu = backendFunction("openMenu", "item", context)
  const perform = backendFunction("performAction", "data", context)
  return { shell, open: id => JSON.parse(JSON.stringify(perform({ id }))) }
}

// Fake KDE tools: each prints what the real one prints (see the comments in
// core/OmarchyMenu.js) or records its arguments NUL-separated.
function fakeTools(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plasmacast-kde-"))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const tool = (name, body) => fs.writeFileSync(path.join(dir, name), "#!/bin/bash\n" + body, { mode: 0o755 })
  const record = 'printf "%s\\0" "$0" "$@"\n'
  tool("kreadconfig6", 'case "$*" in *ColorScheme*) echo BreezeDark ;; *LookAndFeelPackage*) echo org.kde.breezedark.desktop ;; esac\n')
  // plasma-apply-colorscheme's list is translated; only " * " is fixed.
  tool("plasma-apply-colorscheme", '[[ $1 == --list-schemes ]] || { ' + record + 'exit; }\nprintf "Die folgenden Farbschemata sind verfügbar:\\n * BreezeClassic\\n * BreezeDark (aktuelles Farbschema)\\n * My Scheme\\n"\n')
  tool("plasma-apply-lookandfeel", '[[ $1 == --list ]] || { ' + record + 'exit; }\nprintf "org.kde.breeze.desktop\\norg.kde.breezedark.desktop\\n"\n')
  tool("powerprofilesctl", 'case "$1" in get) echo balanced ;; list) printf "  performance:\\n    CpuDriver:\\tamd_pstate\\n\\n* balanced:\\n    CpuDriver:\\tamd_pstate\\n\\n  power-saver:\\n    Degraded:   no\\n" ;; *) ' + record + ' ;; esac\n')
  return { dir, env: { ...process.env, PATH: dir + ":" + process.env.PATH } }
}

test("the KDE menu parses and only uses providers plasmacast implements", () => {
  assert.equal(parsed.error, "")
  assert.ok(parsed.items.length > 20)
  for (const item of parsed.items) {
    if (item.provider) assert.ok(OmarchyMenu.PROVIDERS[item.provider], item.id + " uses unknown provider " + item.provider)
    assert.ok(item.iconName, item.id + " has a theme icon")
    assert.ok(tree.items[item.parent] || item.parent === "root", item.id + " has a parent menu")
  }
})

test("power actions keep the confirmation alert", () => {
  for (const id of ["system.shutdown", "system.reboot", "system.logout"]) {
    assert.ok(tree.items[id] && tree.items[id].action, id)
    assert.ok(RootSearch.confirmationFor("omarchy:" + id, "open"), id + " asks before running")
  }
})

test("top-level KDE menus show at the root, actions only while searching", () => {
  const candidates = RootSearch.menuCandidates(tree, {}, {}, deps)
  const system = candidates.find(c => c.id === "omarchy:system")
  assert.equal(system.subtitle, "KDE")
  assert.equal(system.rootSearch.when, "always")
  assert.equal(system.iconName, "system-shutdown")
  assert.equal(system.glyph, "")
  const lock = candidates.find(c => c.id === "omarchy:system.lock")
  assert.equal(lock.subtitle, "System")
  assert.equal(lock.rootSearch.when, "searching")
})

test("actions run their command and menus open in plasmacast", () => {
  const h = harness(tree)
  assert.deepEqual(h.open("omarchy:system.lock"), { close: true })
  assert.deepEqual(h.shell, ["loginctl lock-session"])
  assert.deepEqual(h.open("omarchy:appearance"), { push: { kind: "menu", menuId: "appearance", title: "Appearance" } })
})

test("an unknown provider from the user's menu fails with a toast instead of summoning Omarchy", () => {
  const custom = OmarchyMenu.buildTree(parsed.items, OmarchyMenu.parse('{"custom":{"label":"Custom","provider":"nope"}}').items)
  const r = harness(custom).open("omarchy:custom")
  assert.equal(r.toast.style, "failure")
  assert.match(r.toast.title, /nope/)
})

test("guards hide light/dark mode by the current color scheme", t => {
  const { env } = fakeTools(t)
  const out = execFileSync("bash", ["-c", OmarchyMenu.guardScript(tree)], { env, encoding: "utf8" })
  const guards = OmarchyMenu.parseGuardOutput(out)
  assert.equal(guards.when["appearance.dark"], false)
  assert.equal(guards.when["appearance.light"], true)
  assert.equal(guards.when["system.power-profile"], true)
})

for (const [provider, menuId, rows, setArgv] of [
  ["color-schemes", "appearance.color-scheme",
    [["BreezeClassic", false], ["BreezeDark", true], ["My Scheme", false]],
    v => ["plasma-apply-colorscheme", v]],
  ["global-themes", "appearance.global-theme",
    [["org.kde.breeze.desktop", false], ["org.kde.breezedark.desktop", true]],
    v => ["plasma-apply-lookandfeel", "--apply", v]],
  ["power-profiles", "system.power-profile",
    [["Performance", false], ["Balanced", true], ["Power-saver", false]],
    v => ["powerprofilesctl", "set", v]]
]) {
  test(provider + " lists rows, marks the current one and applies values literally", t => {
    const { dir, env } = fakeTools(t)
    const output = execFileSync("bash", ["-c", OmarchyMenu.PROVIDERS[provider].script], { env, encoding: "utf8" })
    const items = OmarchyMenu.providerItems(menuId, provider, output)
    assert.deepEqual(items.map(r => [r.label, r.isCurrent]), rows)
    assert.ok(items.every(r => r.iconName && r.parent === menuId))
    const value = "it's $(touch " + path.join(dir, "injected") + ") `id`"
    const recorded = execFileSync("bash", ["-c", OmarchyMenu.PROVIDERS[provider].actionFor(value)], { env, encoding: "utf8" })
    assert.deepEqual(recorded.split("\0").slice(0, -1).map((a, i) => i === 0 ? path.basename(a) : a), setArgv(value))
    assert.equal(fs.existsSync(path.join(dir, "injected")), false)
    assert.deepEqual(OmarchyMenu.providerItems(menuId, provider, ""), [])
  })
}

test("provider rows are searchable under their menu", () => {
  const providers = { "appearance.color-scheme": OmarchyMenu.providerItems("appearance.color-scheme", "color-schemes", "BreezeDark\tBreezeDark\tBreezeDark\n") }
  const candidates = RootSearch.menuCandidates(tree, {}, providers, deps)
  const row = candidates.find(c => c.id === "omarchy:appearance.color-scheme.breezedark")
  assert.ok(row && row.checked)
  assert.equal(row.subtitle, "Appearance › Color Scheme")
})
