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

for (const name of ["quick-note.js", "new-session.js", "open-session.js", "new-page.js", "open-cheat-sheet.js", "update.js", "check-backup.js", "dndbeyond-import.js", "dndbeyond-refresh.js", "dndbeyond-signin.js", "dndbeyond-signout.js", "pick-character.js", "make-line-private.js", "make-private.js", "make-shared.js"]) {
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
async function runScript(name, { lk, app = {}, quickAddApi = {}, requestUrl, platform }) {
  const notices = [];
  const obsidian = { Platform: platform, Notice: class { constructor(m) { notices.push(m); } }, requestUrl: requestUrl ?? (async () => { throw new Error("no network in tests"); }) };
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

test("check-backup.js uses the verbatim boot lines", () => {
  const src = fs.readFileSync(path.join(DIR, "check-backup.js"), "utf8");
  assert.ok(src.includes("const lk = await m.exports(app);"));
  assert.ok(src.includes("lk.backup.backupStatus("));
});

const identity = require("../_lorekeeper/lib/identity.js");

async function pick(choice, { files = ["Vex.md", "Aria.md", "notes.txt"], desktop = true } = {}) {
  const store = new Map();
  const written = {};
  const fakeFs = { readFileSync: () => { throw Object.assign(new Error("x"), { code: "ENOENT" }); }, mkdirSync() {}, writeFileSync: (p, t) => (written[p] = t) };
  globalThis.window = { require: (n) => (n === "fs" ? fakeFs : n === "os" ? { homedir: () => "/home/me" } : path.posix) };
  const shown = [];
  const lk = { party: require("../_lorekeeper/lib/party.js"), identity, io: { list: async () => files } };
  const app = { vault: { adapter: { basePath: "/V" } }, loadLocalStorage: (k) => store.get(k) ?? null, saveLocalStorage: (k, v) => (v === null ? store.delete(k) : store.set(k, v)) };
  const notices = await runScript("pick-character.js", { lk, app, quickAddApi: { suggester: async (_d, vals) => { shown.push(vals); return choice(vals); } }, platform: { isDesktopApp: desktop } });
  delete globalThis.window;
  return { notices, store, written, shown };
}

test("pick-character lists PCs sorted, then DM and solo", async () => {
  const { shown } = await pick(() => null);
  assert.deepEqual(shown[0], ["Aria", "Vex", "I'm the DM (no character)", "Play solo"]);
});

test("pick-character: a PC", async () => {
  const r = await pick(() => "Vex");
  assert.deepEqual(r.notices, ["You play Vex."]);
  assert.equal(r.store.get(identity.KEY), "Vex");
  assert.equal(r.written["/home/me/.config/lorekeeper/me.tsv"], "/V\tVex\n");
});

test("pick-character: the DM and solo", async () => {
  const dm = await pick((v) => v.at(-2));
  assert.deepEqual(dm.notices, ["You're the DM."]);
  assert.equal(dm.store.get(identity.KEY), "DM");
  const solo = await pick((v) => v.at(-1));
  assert.deepEqual(solo.notices, ["Playing solo."]);
  assert.equal(solo.store.has(identity.KEY), false);
});

test("pick-character refuses a PC page named DM", async () => {
  const r = await pick(() => "DM", { files: ["DM.md"] });
  assert.deepEqual(r.notices, ["A PC page named DM can't be the character you play."]);
  assert.equal(r.store.has(identity.KEY), false);
});

test("pick-character off desktop skips the file", async () => {
  const r = await pick(() => "Vex", { desktop: false });
  assert.deepEqual(r.written, {});
  assert.equal(r.store.get(identity.KEY), "Vex");
});

const partyLib = require("../_lorekeeper/lib/party.js");
const sessionLib = require("../_lorekeeper/lib/session.js");

// A fake editor over an array of lines; log records every change so tests can order it against the file write.
function fakeEditor(initial, selection, log) {
  const lines = [...initial];
  const pos = (p) => lines.slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.ch;
  return {
    lines,
    listSelections: () => [selection],
    getLine: (i) => lines[i],
    lineCount: () => lines.length,
    replaceRange(text, f, t) {
      log.push("editor");
      const all = lines.join("\n");
      lines.splice(0, lines.length, ...(all.slice(0, pos(f)) + text + all.slice(pos(t))).split("\n"));
    },
  };
}

function privateRun({ doc, from, to, path = "NPCs/Halia.md", me = "Vex", type = "npc", files = {}, failWrite = false }) {
  const log = [];
  const disk = { "_lorekeeper/templates/session.md": "# S{{session}}\n", "_lorekeeper/templates/session-part.md": "{{author}} {{session}}\n", ...files };
  const io = {
    list: async (d) => (d === "Sessions" ? ["Session 3.md"] : []),
    exists: async (p) => p in disk,
    read: async (p) => disk[p],
    mtimeMs: async () => 0,
    write: async (p, t) => { log.push(`write ${p}`); if (failWrite) throw new Error("disk full"); disk[p] = t; },
  };
  const range = (l, c) => ({ line: l, ch: c });
  const editor = fakeEditor(doc, { anchor: range(from[0], from[1]), head: range(to[0], to[1]) }, log);
  const file = { path, basename: path.split("/").pop().replace(/\.md$/, ""), extension: "md" };
  const app = {
    loadLocalStorage: () => me,
    workspace: { activeEditor: { editor, file } },
    metadataCache: { getFileCache: () => ({ frontmatter: type ? { type } : {} }) },
  };
  const lk = { party: partyLib, session: sessionLib, identity, io };
  return { lk, app, editor, disk, log };
}

async function runPrivate(r) {
  return runScript("make-line-private.js", { lk: r.lk, app: r.app });
}

test("make-line-private moves lines into the private session file, writing before the editor changes", async () => {
  const r = privateRun({ doc: ["# Halia", "met her", "- 20:14 ~ owes me", "tail"], from: [1, 0], to: [2, 5] });
  const notices = await runPrivate(r);
  assert.deepEqual(notices, ["Moved 2 notes to your private notes."]);
  assert.deepEqual(r.editor.lines, ["# Halia", "tail"]);
  const p = "Private/Vex/Sessions/Session 3.md";
  assert.equal(r.disk[p], '"[[Vex]]" 3\n@[[Halia]] met her\n- 20:14 @[[Halia]] owes me\n');
  assert.ok(r.log.findIndex((x) => x.startsWith("write")) < r.log.indexOf("editor"));
  assert.equal(r.log.filter((x) => x === "editor").length, 2);
});

test("make-line-private on a session page uses that session and adds no page link", async () => {
  const r = privateRun({ doc: ["- 20:14 ~ secret"], from: [0, 0], to: [0, 0], path: "Sessions/Session 2/Vex.md", type: "" });
  await runPrivate(r);
  assert.equal(r.disk["Private/Vex/Sessions/Session 2.md"].split("\n").slice(1).join("\n"), "- 20:14 secret\n");
  assert.deepEqual(r.editor.lines, [""]);
});

test("make-line-private skips blank and lone ~ lines and leaves them in the editor", async () => {
  const r = privateRun({ doc: ["a", "", "~", "b"], from: [0, 0], to: [3, 1] });
  const notices = await runPrivate(r);
  assert.deepEqual(notices, ["Moved 2 notes to your private notes."]);
  assert.deepEqual(r.editor.lines, ["", "~"]);
  assert.ok(r.disk["Private/Vex/Sessions/Session 3.md"].endsWith("@[[Halia]] a\n@[[Halia]] b\n"));
});

test("make-line-private says Nothing to move. when every line is skipped", async () => {
  const r = privateRun({ doc: ["", "~"], from: [0, 0], to: [1, 1] });
  assert.deepEqual(await runPrivate(r), ["Nothing to move."]);
  assert.deepEqual(r.editor.lines, ["", "~"]);
  assert.deepEqual(r.log, []);
});

test("make-line-private leaves the editor alone when the write fails", async () => {
  const r = privateRun({ doc: ["a", "b"], from: [0, 0], to: [0, 1], failWrite: true });
  assert.deepEqual(await runPrivate(r), ["Couldn't move the notes: disk full"]);
  assert.deepEqual(r.editor.lines, ["a", "b"]);
  assert.equal(r.log.includes("editor"), false);
});

test("make-line-private refuses inside the properties, in solo mode and in private files", async () => {
  const fm = ["---", "type: npc", "---", "body"];
  const inFm = privateRun({ doc: fm, from: [1, 0], to: [1, 3] });
  assert.deepEqual(await runPrivate(inFm), ["The properties at the top of a page can't be made private."]);
  const spans = privateRun({ doc: fm, from: [2, 0], to: [3, 2] });
  assert.equal((await runPrivate(spans))[0], "The properties at the top of a page can't be made private.");
  const after = privateRun({ doc: fm, from: [3, 0], to: [3, 2] });
  assert.deepEqual(await runPrivate(after), ["Moved 1 note to your private notes."]);
  assert.deepEqual(after.editor.lines, ["---", "type: npc", "---"]);
  const solo = privateRun({ doc: ["a"], from: [0, 0], to: [0, 1], me: "" });
  assert.match((await runPrivate(solo))[0], /^Pick your character first/);
  assert.deepEqual(solo.editor.lines, ["a"]);
  const priv = privateRun({ doc: ["a"], from: [0, 0], to: [0, 1], path: "Private/Vex/NPCs/Halia.md" });
  assert.deepEqual(await runPrivate(priv), ["This page is already private."]);
});

test("make-line-private: a selection ending at column 0 leaves that line out; the cursor line works alone", async () => {
  const r = privateRun({ doc: ["a", "b", "c"], from: [0, 0], to: [2, 0] });
  await runPrivate(r);
  assert.deepEqual(r.editor.lines, ["c"]);
  const last = privateRun({ doc: ["a", "b"], from: [1, 1], to: [1, 1] });
  await runPrivate(last);
  assert.deepEqual(last.editor.lines, ["a"]);
});

function pageApp({ path, me = "Vex", existing = [] }) {
  const renamed = [];
  const folders = [];
  const file = { path, basename: path.split("/").pop().replace(/\.md$/, ""), extension: "md" };
  const app = {
    loadLocalStorage: () => me,
    workspace: { getActiveFile: () => file },
    fileManager: { renameFile: async (f, to) => renamed.push([f.path, to]) },
    vault: { getAbstractFileByPath: (p) => (existing.includes(p) ? { path: p } : null), createFolder: async (p) => { folders.push(p); existing.push(p); } },
  };
  return { app, renamed, folders, lk: { party: partyLib, identity } };
}

test("make-private moves a page under your Private folder, creating folders", async () => {
  const r = pageApp({ path: "NPCs/Halia.md" });
  assert.deepEqual(await runScript("make-private.js", r), ["Halia is now private."]);
  assert.deepEqual(r.renamed, [["NPCs/Halia.md", "Private/Vex/NPCs/Halia.md"]]);
  assert.deepEqual(r.folders, ["Private", "Private/Vex", "Private/Vex/NPCs"]);
});

test("make-private refuses a private page and solo mode", async () => {
  const priv = pageApp({ path: "Private/Vex/NPCs/Halia.md" });
  assert.deepEqual(await runScript("make-private.js", priv), ["That page is already private."]);
  const solo = pageApp({ path: "NPCs/Halia.md", me: "" });
  assert.match((await runScript("make-private.js", solo))[0], /^Pick your character first/);
  assert.deepEqual(solo.renamed, []);
});

test("make-shared asks first, then moves the page out of Private", async () => {
  const asked = [];
  const r = pageApp({ path: "Private/Vex/NPCs/Halia.md", existing: ["NPCs"] });
  const notices = await runScript("make-shared.js", { ...r, quickAddApi: { yesNoPrompt: async (...a) => (asked.push(a), true) } });
  assert.deepEqual(asked, [["Share Halia with the party?", "Everyone who shares this campaign gets it."]]);
  assert.deepEqual(r.renamed, [["Private/Vex/NPCs/Halia.md", "NPCs/Halia.md"]]);
  assert.deepEqual(notices, ["Halia is now shared."]);
});

test("make-shared does nothing when you say no", async () => {
  const r = pageApp({ path: "Private/Vex/NPCs/Halia.md" });
  assert.deepEqual(await runScript("make-shared.js", { ...r, quickAddApi: { yesNoPrompt: async () => false } }), []);
  assert.deepEqual(r.renamed, []);
});

test("make-shared refuses someone else's page, an existing target and a shared page", async () => {
  const api = { yesNoPrompt: async () => { throw new Error("must not ask"); } };
  const other = pageApp({ path: "Private/Halia/NPCs/Bob.md" });
  assert.deepEqual(await runScript("make-shared.js", { ...other, quickAddApi: api }), ["That's Halia's private page."]);
  const taken = pageApp({ path: "Private/Vex/NPCs/Halia.md", existing: ["NPCs/Halia.md"] });
  assert.deepEqual(await runScript("make-shared.js", { ...taken, quickAddApi: api }), ["There's already a shared page called Halia."]);
  const shared = pageApp({ path: "NPCs/Halia.md" });
  assert.deepEqual(await runScript("make-shared.js", { ...shared, quickAddApi: api }), ["That page is already shared."]);
  for (const r of [other, taken, shared]) assert.deepEqual(r.renamed, []);
});

function newPage({ me, choice }) {
  const created = [];
  const folders = [];
  const asked = [];
  const lk = {
    pages: require("../_lorekeeper/lib/pages.js"), party: partyLib, identity,
    io: { list: async () => ["NPC.md"] },
  };
  const exist = new Set();
  const app = {
    loadLocalStorage: () => me,
    plugins: { plugins: { "templater-obsidian": { templater: { create_new_note_from_template: async (t, f, n) => created.push([t.path, f.path ?? "/", n]) } } } },
    vault: {
      getMarkdownFiles: () => [],
      getRoot: () => ({ path: "/", children: [{ name: "NPCs", children: [] }] }),
      getAbstractFileByPath: (p) => (exist.has(p) ? { path: p } : p.startsWith("Templates/") ? { path: p } : null),
      createFolder: async (p) => { folders.push(p); exist.add(p); },
    },
  };
  const quickAddApi = {
    suggester: async (d, v) => { asked.push(v); return v.includes("Shared") ? choice : "NPC"; },
    inputPrompt: async () => "Halia",
  };
  return { lk, app, quickAddApi, created, folders, asked };
}

test("new-page in party mode offers Shared or Private, and private lands under Private/<you>/", async () => {
  const r = newPage({ me: "Vex", choice: "Private" });
  await runScript("new-page.js", r);
  assert.deepEqual(r.asked[1], ["Shared", "Private"]);
  assert.deepEqual(r.folders, ["Private", "Private/Vex", "Private/Vex/NPCs"]);
  assert.deepEqual(r.created, [["Templates/NPC.md", "Private/Vex/NPCs", "Halia"]]);
  const shared = newPage({ me: "Vex", choice: "Shared" });
  await runScript("new-page.js", shared);
  assert.deepEqual(shared.created, [["Templates/NPC.md", "NPCs", "Halia"]]);
});

test("new-page in solo mode never asks Shared or Private", async () => {
  const r = newPage({ me: "", choice: "Private" });
  await runScript("new-page.js", r);
  assert.equal(r.asked.length, 1);
  assert.deepEqual(r.created, [["Templates/NPC.md", "NPCs", "Halia"]]);
});
