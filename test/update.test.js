const { test } = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const u = require("../_lorekeeper/lib/update.js");

test("categorize follows the spec's lists", () => {
  for (const p of ["_lorekeeper/lib/notes.js", ".obsidian/themes/Lorekeeper/theme.css", ".obsidian/plugins/dataview/main.js",
    ".obsidian/plugins/templater-obsidian/LICENSE", "CREDITS.md", "docs/CAPTURE.md", "docs/BACKUP.md", "docs/DNDBEYOND.md"])
    assert.equal(u.categorize(p), "managed", p);
  for (const p of ["Templates/NPC.md", ".obsidian/plugins/quickadd/data.json", ".obsidian/hotkeys.json", ".obsidian/app.json",
    ".obsidian/appearance.json", ".obsidian/core-plugins.json", ".obsidian/community-plugins.json", ".obsidian/graph.json",
    ".obsidian/bookmarks.json", "Home.md", "Cheat Sheet.md"])
    assert.equal(u.categorize(p), "shared", p);
  for (const p of ["_lorekeeper/installed.json", "Sessions/Session 1.md", "NPCs/Mirela.md", "README.md", "docs/CHECKLIST.md",
    "test/notes.test.js", "Templates/sub/x.md", ".obsidian/workspace.json", "Sessions/.gitkeep", "lorekeeper.json"])
    assert.equal(u.categorize(p), null, p);
});

const rel = (files, plugins = []) => ({ version: "0.2.0", plugins,
  files: Object.fromEntries(Object.entries(files).map(([p, sha]) => [p, { sha256: sha, kind: u.categorize(p) }])) });

test("adds new files, replaces changed managed files, leaves identical ones", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "_lorekeeper/lib/a.js": "a1", "_lorekeeper/lib/b.js": "b1" }, plugins: [] },
    current: { "_lorekeeper/lib/a.js": "a1", "_lorekeeper/lib/b.js": "b1" },
    release: rel({ "_lorekeeper/lib/a.js": "a2", "_lorekeeper/lib/b.js": "b1", "_lorekeeper/lib/c.js": "c1" }),
  });
  assert.deepEqual(plan, { add: ["_lorekeeper/lib/c.js"], replace: ["_lorekeeper/lib/a.js"], kept: [], remove: [], merge: [] });
});

test("keeps an edited shared file", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "Templates/NPC.md": "t1" }, plugins: [] },
    current: { "Templates/NPC.md": "edited" },
    release: rel({ "Templates/NPC.md": "t2" }),
  });
  assert.deepEqual(plan.kept, ["Templates/NPC.md"]);
  assert.deepEqual(plan.replace, []);
});

test("replaces an unedited shared file", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "Home.md": "h1" }, plugins: [] },
    current: { "Home.md": "h1" },
    release: rel({ "Home.md": "h2" }),
  });
  assert.deepEqual(plan.replace, ["Home.md"]);
});

test("replaces a managed file even when edited", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "_lorekeeper/lib/a.js": "a1" }, plugins: [] },
    current: { "_lorekeeper/lib/a.js": "hacked" },
    release: rel({ "_lorekeeper/lib/a.js": "a2" }),
  });
  assert.deepEqual(plan.replace, ["_lorekeeper/lib/a.js"]);
});

test("re-creates a deleted managed file", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "_lorekeeper/lib/a.js": "a1" }, plugins: [] },
    current: {},
    release: rel({ "_lorekeeper/lib/a.js": "a1" }),
  });
  assert.deepEqual(plan.add, ["_lorekeeper/lib/a.js"]);
});

test("does not re-create a deleted shared file", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "Cheat Sheet.md": "c1" }, plugins: [] },
    current: {},
    release: rel({ "Cheat Sheet.md": "c2" }),
  });
  assert.deepEqual(plan, { add: [], replace: [], kept: ["Cheat Sheet.md"], remove: [], merge: [] });
});

test("a shared file new in this release is added when absent", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: {}, plugins: [] },
    current: {},
    release: rel({ ".obsidian/plugins/obsidian-git/data.json": "g1" }),
  });
  assert.deepEqual(plan.add, [".obsidian/plugins/obsidian-git/data.json"]);
});

test("removes managed and unedited shared files the release dropped, keeps edited ones", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { "_lorekeeper/old.js": "o1", "Templates/Old.md": "t1", "Templates/Mine.md": "m1" }, plugins: [] },
    current: { "_lorekeeper/old.js": "o1", "Templates/Old.md": "t1", "Templates/Mine.md": "edited" },
    release: rel({}),
  });
  assert.deepEqual(plan.remove, ["Templates/Old.md", "_lorekeeper/old.js"]);
  assert.deepEqual(plan.kept, ["Templates/Mine.md"]);
});

test("merged files are always listed under merge", () => {
  const plan = u.planUpdate({
    installed: { version: "0.1.0", files: { ".obsidian/community-plugins.json": "x" }, plugins: [] },
    current: { ".obsidian/community-plugins.json": "edited", ".obsidian/plugins/quickadd/data.json": "q" },
    release: rel({ ".obsidian/community-plugins.json": "y", ".obsidian/plugins/quickadd/data.json": "q2" }),
  });
  assert.deepEqual(plan.merge, [".obsidian/community-plugins.json", ".obsidian/plugins/quickadd/data.json"]);
  assert.deepEqual(plan.kept, []);
  assert.deepEqual(plan.replace, []);
});

test("no installed record: every current file counts as unedited only if it matches the baseline", () => {
  const baseline = { version: "0.1.0", files: { "Home.md": "h1", "Templates/NPC.md": "t1" }, plugins: [] };
  const plan = u.planUpdate({
    installed: baseline,
    current: { "Home.md": "h1", "Templates/NPC.md": "edited" },
    release: rel({ "Home.md": "h2", "Templates/NPC.md": "t2" }),
  });
  assert.deepEqual(plan.replace, ["Home.md"]);
  assert.deepEqual(plan.kept, ["Templates/NPC.md"]);
});

test("mergeEnabledPlugins adds only plugins new in this release", () => {
  assert.deepEqual(
    u.mergeEnabledPlugins(["quickadd", "dataview", "obsidian-git"], ["quickadd", "dataview", "custom-selectors"],
      ["quickadd", "dataview", "custom-selectors", "supercharged-links-obsidian"]),
    ["quickadd", "dataview", "obsidian-git", "supercharged-links-obsidian"],
  );
});

test("mergeQuickAdd replaces and adds lk- choices, keeps the player's own", () => {
  const current = { choices: [{ id: "lk-quick-note", name: "old" }, { id: "mine", name: "Mine" }], migrations: { a: true }, extra: 1 };
  const release = { choices: [{ id: "lk-quick-note", name: "Quick note" }, { id: "lk-update", name: "Update Lorekeeper" }], migrations: { a: true, b: true } };
  assert.deepEqual(u.mergeQuickAdd(current, release), {
    choices: [{ id: "lk-quick-note", name: "Quick note" }, { id: "mine", name: "Mine" }, { id: "lk-update", name: "Update Lorekeeper" }],
    migrations: { a: true, b: true },
    extra: 1,
  });
});

test("sha256Hex matches Node's hash of the UTF-8 bytes", async () => {
  assert.equal(await u.sha256Hex("héllo\n", webcrypto.subtle),
    require("node:crypto").createHash("sha256").update("héllo\n", "utf8").digest("hex"));
});

test("rawUrl encodes each path segment", () => {
  assert.equal(u.rawUrl("yonatankarp/lorekeeper-obsidian", "v0.2.0", "Cheat Sheet.md"),
    "https://raw.githubusercontent.com/yonatankarp/lorekeeper-obsidian/v0.2.0/Cheat%20Sheet.md");
  assert.equal(u.rawUrl("a/b", "v1", ".obsidian/plugins/x/main.js"), "https://raw.githubusercontent.com/a/b/v1/.obsidian/plugins/x/main.js");
});
