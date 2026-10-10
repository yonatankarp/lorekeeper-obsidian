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

for (const name of ["quick-note.js", "new-session.js", "open-session.js", "new-page.js", "open-cheat-sheet.js", "update.js", "check-backup.js", "dndbeyond-import.js", "dndbeyond-refresh.js", "dndbeyond-signin.js", "dndbeyond-signout.js"]) {
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

test("hotkeys bind the shortcuts the cheat sheet relies on", () => {
  const ROOT = path.join(__dirname, "..");
  const keys = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/hotkeys.json"), "utf8"));
  for (const id of ["graph:open", "workspace:edit-file-title", "global-search:open"]) assert.ok(keys[id]?.length, id);
  for (const id of ["lk-quick-note", "lk-current-session", "lk-new-page", "lk-cheat-sheet"]) assert.ok(keys[`quickadd:choice:${id}`]?.length, id);
});

test("every ⌘ or F2 row in the cheat sheet's In Obsidian table is bound or an Obsidian default", () => {
  const ROOT = path.join(__dirname, "..");
  const keys = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/hotkeys.json"), "utf8"));
  const MODS = { "⌘": "Mod", "⌥": "Alt", "⇧": "Shift" };
  const bound = new Set();
  for (const list of Object.values(keys)) for (const b of list) bound.add([...b.modifiers, b.key].join("+"));
  const DEFAULTS = new Set(["Mod+O", "Mod+E"]);
  const sheet = fs.readFileSync(path.join(ROOT, "Cheat Sheet.md"), "utf8");
  const section = sheet.split("## In Obsidian")[1].split(/\n## /)[0];
  const rows = section.split("\n").filter((l) => l.startsWith("| `"));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    const span = row.match(/`([^`]+)`/)[1];
    if (!span.startsWith("⌘") && span !== "F2") continue;
    const mods = [];
    let rest = span;
    while (rest.length > 1 && MODS[rest[0]]) { mods.push(MODS[rest[0]]); rest = rest.slice(1); }
    const canon = [...mods, rest].join("+");
    assert.ok(bound.has(canon) || DEFAULTS.has(canon), `${span} is neither bound nor a default`);
  }
});

// Runs a QuickAdd script with a fake lk: load.js is swapped for one that hands back globalThis.__lk.
async function runScript(name, { lk, app = {}, quickAddApi = {}, requestUrl }) {
  const notices = [];
  const obsidian = { Notice: class { constructor(m) { notices.push(m); } }, requestUrl: requestUrl ?? (async () => { throw new Error("no network in tests"); }) };
  const src = fs.readFileSync(path.join(DIR, name), "utf8");
  const m = { exports: {} };
  new Function("module", "exports", src)(m, m.exports);
  globalThis.__lk = lk;
  const adapter = { read: async (p) => (p === "_lorekeeper/lib/load.js" ? "module.exports = async () => globalThis.__lk;" : ""), ...app.vault?.adapter };
  await m.exports({ app: { ...app, vault: { ...app.vault, adapter } }, quickAddApi, obsidian });
  delete globalThis.__lk;
  return notices;
}

test("update.js names each failed file and why", async () => {
  const lk = {
    update: {},
    updater: {
      prepare: async () => ({ release: { version: "0.3.0" }, plan: { add: [], replace: ["Home.md"], remove: [], merge: [], kept: [] } }),
      apply: async () => ({ written: [], reload: false, failed: [{ path: "Home.md", reason: "couldn't download" }, { path: ".obsidian/app.json", reason: "isn't valid JSON" }] }),
    },
  };
  const notices = await runScript("update.js", { lk, quickAddApi: { yesNoPrompt: async () => true } });
  assert.deepEqual(notices, ["Some files didn't update: Home.md (couldn't download), .obsidian/app.json (isn't valid JSON). Run Update Lorekeeper again."]);
});

const dndbeyond = require("../_lorekeeper/lib/dndbeyond.js");
const signin = require("../_lorekeeper/lib/signin.js");
const pcsyncLib = require("../_lorekeeper/lib/pcsync.js");

function secretStore(initial) {
  const store = new Map(initial === undefined ? [] : [[signin.SECRET_ID, initial]]);
  return { store, setSecret: (k, v) => store.set(k, v), getSecret: (k) => store.get(k) ?? null };
}

for (const [label, previous, error, kept, said] of [
  ["an expired cookie signs out", "old", dndbeyond.MESSAGES.expired, "", dndbeyond.MESSAGES.expired],
  ["offline keeps the previous sign-in", "old", dndbeyond.MESSAGES.unreachable, "old", "Couldn't check the sign-in: Couldn't reach D&D Beyond. Check your internet connection. Your previous sign-in is kept."],
  ["a 5xx with no previous sign-in leaves none", undefined, "D&D Beyond's sign-in service said: 503", "", "Couldn't check the sign-in: D&D Beyond's sign-in service said: 503. Your previous sign-in is kept."],
]) {
  test(`sign-in: ${label}`, async () => {
    const secretStorage = secretStore(previous);
    const lk = { signin, dndbeyond, pcsync: { token: async () => { throw new Error(error); } } };
    const notices = await runScript("dndbeyond-signin.js", { lk, app: { secretStorage }, quickAddApi: { inputPrompt: async () => "CobaltSession=new" } });
    assert.equal(secretStorage.store.get(signin.SECRET_ID), kept);
    assert.equal(notices.at(-1), said);
    assert.ok(notices[0].includes("see docs/DNDBEYOND.md in this vault"));
  });
}

test("sign-in: a working cookie is stored", async () => {
  const secretStorage = secretStore("old");
  const lk = { signin, dndbeyond, pcsync: { token: async () => "tok" } };
  const notices = await runScript("dndbeyond-signin.js", { lk, app: { secretStorage }, quickAddApi: { inputPrompt: async () => "new" } });
  assert.equal(secretStorage.store.get(signin.SECRET_ID), "new");
  assert.equal(notices.at(-1), "Signed in to D&D Beyond.");
});

const PC = "---\ndndbeyond: https://www.dndbeyond.com/characters/7\n---\n# Vex\n";

function refreshApp(active, { plugins = {} } = {}) {
  return {
    plugins: { plugins },
    workspace: { getActiveFile: () => active },
    vault: { read: async (f) => (f.path === "PCs/Vex.md" ? PC : "# Note\n") },
  };
}

test("refresh asks for a PC page first, even without Templater", async () => {
  const lk = { dndbeyond, pcsync: pcsyncLib };
  assert.deepEqual(await runScript("dndbeyond-refresh.js", { lk, app: refreshApp(null) }), ["Open a PC page with a D&D Beyond link first."]);
  assert.deepEqual(await runScript("dndbeyond-refresh.js", { lk, app: refreshApp({ path: "NPCs/Bob.md" }) }), ["Open a PC page with a D&D Beyond link first."]);
});

test("refresh works without Templater and updates the open page", async () => {
  let args;
  const lk = { dndbeyond, pcsync: { ...pcsyncLib, token: async () => "", syncCharacter: async (app, deps, c) => { args = { deps, c }; return { path: "PCs/Vex.md", created: false }; } } };
  const requestUrl = async () => ({ status: 200, json: { data: { name: "Vex" } } });
  const notices = await runScript("dndbeyond-refresh.js", { lk, app: refreshApp({ path: "PCs/Vex.md", basename: "Vex" }), requestUrl });
  assert.deepEqual(notices, ["Refreshed Vex."]);
  assert.equal(args.deps.templater, undefined);
  assert.deepEqual(args.deps.notes, [{ path: "PCs/Vex.md", dndbeyond: "https://www.dndbeyond.com/characters/7" }]);
  assert.equal(args.c.id, 7);
});

test("refresh refuses a 2xx reply with no character in it", async () => {
  let synced = false;
  const lk = { dndbeyond, pcsync: { ...pcsyncLib, token: async () => "", syncCharacter: async () => { synced = true; } } };
  for (const json of [{ data: [] }, { data: null }, null]) {
    const notices = await runScript("dndbeyond-refresh.js", { lk, app: refreshApp({ path: "PCs/Vex.md" }), requestUrl: async () => ({ status: 200, json }) });
    assert.deepEqual(notices, [dndbeyond.characterError(200, json, "7")]);
  }
  assert.equal(synced, false);
});

test("refresh reports a page it can't read", async () => {
  const app = refreshApp({ path: "PCs/Vex.md" });
  app.vault.read = async () => { throw new Error("Couldn't read PCs/Vex.md."); };
  assert.deepEqual(await runScript("dndbeyond-refresh.js", { lk: { dndbeyond, pcsync: pcsyncLib }, app }), ["Couldn't read PCs/Vex.md."]);
});

function importLk(found, sync = async () => ({ path: "PCs/x.md", created: true })) {
  return { dndbeyond: { ...dndbeyond, lookup: async () => found }, pcsync: { ...pcsyncLib, token: async () => "", pcNotes: async () => [], syncCharacter: sync } };
}
const character = (id, name, error = "") => ({ id, name, error });
const importApp = { plugins: { plugins: { "templater-obsidian": { templater: {} } } } };

test("import gives the checkbox a header, makes labels unique and maps ticks by index", async () => {
  let prompt;
  const synced = [];
  const lk = importLk([character(1, "Vex"), character(2, "Vex"), character(3, "Pike")], async (app, deps, c) => { synced.push(c.id); return { path: "", created: true }; });
  const quickAddApi = {
    inputPrompt: async () => "1",
    checkboxPrompt: async (items, selected, header) => { prompt = { items, selected, header }; return ["Vex (#2)", "Pike"]; },
  };
  const notices = await runScript("dndbeyond-import.js", { lk, app: importApp, quickAddApi });
  assert.deepEqual(prompt.items, ["Vex (#1)", "Vex (#2)", "Pike"]);
  assert.equal(prompt.header, "Untick any you don't want.");
  assert.deepEqual(synced, [2, 3]);
  assert.deepEqual(notices, ["Imported 2 characters."]);
});

test("import says Nothing imported. when nothing was, plus any errors", async () => {
  const quickAddApi = { inputPrompt: async () => "1", checkboxPrompt: async (items) => items };
  const failing = importLk([character(1, "Vex", "D&D Beyond won't share this character.")]);
  assert.deepEqual(await runScript("dndbeyond-import.js", { lk: failing, app: importApp, quickAddApi }), ["Nothing imported.\nVex: D&D Beyond won't share this character."]);
  const none = importLk([character(1, "Vex")]);
  assert.deepEqual(await runScript("dndbeyond-import.js", { lk: none, app: importApp, quickAddApi: { ...quickAddApi, checkboxPrompt: async () => [] } }), ["Nothing imported."]);
});
