const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "_lorekeeper/scripts");
const BOOT = 'new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);';

// Dataview 0.5.70 compiles a view as new Function("dv", "input", body), wrapping the body in an async arrow function
// when it contains "await" (its view() in main.js). QuickAdd loads a script as CommonJS.
test("session.js compiles the way dv.view compiles it", () => {
  const src = fs.readFileSync(path.join(DIR, "session.js"), "utf8");
  assert.ok(src.includes("await"));
  assert.doesNotThrow(() => new Function("dv", "input", "(async () => { " + src + " })()"));
  assert.ok(src.includes(BOOT), "uses the load.js boot lines");
});

for (const name of ["quick-note.js", "new-session.js", "open-session.js", "new-page.js", "open-cheat-sheet.js"]) {
  test(`${name} compiles as a CommonJS module exporting a function`, () => {
    const src = fs.readFileSync(path.join(DIR, name), "utf8");
    const m = { exports: {} };
    new Function("module", "exports", src)(m, m.exports);
    assert.equal(typeof m.exports, "function");
    if (name !== "open-cheat-sheet.js") assert.ok(src.includes(BOOT), "uses the load.js boot lines");
  });
}

test("every QuickAdd script exists and every hotkey names a QuickAdd choice", () => {
  const ROOT = path.join(__dirname, "..");
  const qa = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/quickadd/data.json"), "utf8"));
  const ids = qa.choices.map((c) => c.id);
  for (const c of qa.choices) for (const cmd of c.macro.commands) assert.ok(fs.existsSync(path.join(ROOT, cmd.path)), cmd.path);
  const keys = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/hotkeys.json"), "utf8"));
  for (const k of Object.keys(keys).filter((k) => k.startsWith("quickadd:choice:"))) assert.ok(ids.includes(k.slice(16)), k);
});
