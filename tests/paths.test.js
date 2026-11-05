const test = require("node:test")
const assert = require("node:assert/strict")
const Paths = require("../core/Paths.js")

const envOf = (vars) => (name) => vars[name] || ""

test("defaults follow the XDG base directory spec", () => {
  const p = Paths.resolve(envOf({ HOME: "/home/u", XDG_RUNTIME_DIR: "/run/user/1000" }))
  assert.equal(p.config, "/home/u/.config/plasmacast")
  assert.equal(p.configFile, "/home/u/.config/plasmacast/config.json")
  assert.equal(p.db, "/home/u/.local/share/plasmacast/db")
  assert.equal(p.extensions, "/home/u/.local/share/plasmacast/extensions")
  assert.equal(p.cache, "/home/u/.cache/plasmacast")
  assert.equal(p.logs, "/home/u/.local/state/plasmacast/logs")
  assert.equal(p.runtime, "/run/user/1000/plasmacast")
  assert.equal(p.scriptCommands, "/home/u/.config/plasmacast/script-commands")
})

test("absolute XDG overrides win, relative ones are ignored", () => {
  const p = Paths.resolve(envOf({
    HOME: "/home/u/",
    XDG_CONFIG_HOME: "/cfg/",
    XDG_DATA_HOME: "relative/data",
    XDG_STATE_HOME: "/st"
  }))
  assert.equal(p.config, "/cfg/plasmacast")
  assert.equal(p.data, "/home/u/.local/share/plasmacast")
  assert.equal(p.state, "/st/plasmacast")
})

test("missing HOME is an error", () => {
  assert.throws(() => Paths.resolve(envOf({})), /HOME is not set/)
})

test("startup creates the persistent dirs and the runtime dir", () => {
  const p = Paths.resolve(envOf({ HOME: "/h", XDG_RUNTIME_DIR: "/r" }))
  assert.deepEqual(Paths.directoriesToCreate(p), [
    "/h/.config/plasmacast", "/h/.local/share/plasmacast/db", "/h/.cache/plasmacast",
    "/h/.local/state/plasmacast/logs", "/h/.local/state/plasmacast/backups", "/r/plasmacast"
  ])
})

test("directories under the old omacast and oma-cast names move to plasmacast, newest name first", () => {
  const p = Paths.resolve(envOf({ HOME: "/h", XDG_CONFIG_HOME: "/cfg" }))
  assert.deepEqual(Paths.legacyMoves(p), [
    ["/cfg/omacast", "/cfg/plasmacast"], ["/cfg/oma-cast", "/cfg/plasmacast"],
    ["/h/.local/share/omacast", "/h/.local/share/plasmacast"], ["/h/.local/share/oma-cast", "/h/.local/share/plasmacast"],
    ["/h/.cache/omacast", "/h/.cache/plasmacast"], ["/h/.cache/oma-cast", "/h/.cache/plasmacast"],
    ["/h/.local/state/omacast", "/h/.local/state/plasmacast"], ["/h/.local/state/oma-cast", "/h/.local/state/plasmacast"]
  ])
})
