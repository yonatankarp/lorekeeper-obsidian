const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lorekeeper = require("../_lorekeeper/lib/load.js");

const ROOT = path.join(__dirname, "..");

// A fake Obsidian app: reads lib/ from the repo, keeps written files in memory.
function fakeApp() {
  const files = new Map();
  const folders = new Set(["Sessions"]);
  const created = [];
  const vault = {
    adapter: {
      read: async (p) => (files.has(p) ? files.get(p) : fs.readFileSync(path.join(ROOT, p), "utf8")),
      exists: async (p) => files.has(p) || folders.has(p),
      list: async (dir) => ({
        files: [...files.keys()].filter((p) => path.dirname(p) === dir),
        folders: [...folders].filter((p) => path.dirname(p) === dir),
      }),
      stat: async () => ({ mtime: 1000 }),
    },
    getAbstractFileByPath: (p) => (files.has(p) ? { path: p } : folders.has(p) ? { path: p, children: [] } : null),
    modify: async (f, text) => files.set(f.path, text),
    create: async (p, text) => (created.push(p), files.set(p, text)),
    createFolder: async (p) => folders.add(p),
  };
  return { app: { vault }, files, folders, created };
}

test("loads every lib module", async () => {
  const lk = await lorekeeper(fakeApp().app);
  assert.equal(lk.notes.SECTIONS.length, 6);
  assert.equal(lk.session.sessionPath(2), "Sessions/Session 2.md");
  assert.equal(typeof lk.pages.nameProblem, "function");
  assert.equal(typeof lk.coins.coinsHtml, "function");
});

test("io writes through the vault, making folders", async () => {
  const { app, files, folders, created } = fakeApp();
  const { io } = await lorekeeper(app);
  await io.write("Quests/Find the miners.md", "a");
  assert.ok(folders.has("Quests"));
  assert.deepEqual(created, ["Quests/Find the miners.md"]);
  await io.write("Quests/Find the miners.md", "b");
  assert.equal(files.get("Quests/Find the miners.md"), "b");
  assert.deepEqual(created, ["Quests/Find the miners.md"]);
});

test("io.list gives names, and [] for a missing folder", async () => {
  const { app } = fakeApp();
  const { io } = await lorekeeper(app);
  await io.write("Sessions/Session 1.md", "x");
  assert.deepEqual(await io.list("Sessions"), ["Session 1.md"]);
  assert.deepEqual(await io.list("Nope"), []);
  assert.equal(await io.mtimeMs("Sessions/Session 1.md"), 1000);
});
