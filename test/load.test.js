const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lorekeeper = require("../_lorekeeper/lib/load.js");

const ROOT = path.join(__dirname, "..");

// A fake Obsidian app: reads lib/ from the repo. `files` and `folders` are what is on disk; `indexed` is what the
// vault knows about, which can lag behind disk (a file written outside Obsidian, e.g. by lk-note). Like Obsidian,
// create and createFolder throw when the path exists on disk.
function fakeApp() {
  const files = new Map();
  const folders = new Set(["Sessions"]);
  const indexed = new Set(["Sessions"]);
  const created = [];
  const createdFolders = [];
  const vault = {
    adapter: {
      read: async (p) => (files.has(p) ? files.get(p) : fs.readFileSync(path.join(ROOT, p), "utf8")),
      write: async (p, text) => files.set(p, text),
      exists: async (p) => files.has(p) || folders.has(p),
      list: async (dir) => ({
        files: [...files.keys()].filter((p) => path.dirname(p) === dir),
        folders: [...folders].filter((p) => path.dirname(p) === dir),
      }),
      stat: async () => ({ mtime: 1000 }),
    },
    getAbstractFileByPath: (p) =>
      !indexed.has(p) ? null : folders.has(p) ? { path: p, children: [] } : { path: p },
    modify: async (f, text) => files.set(f.path, text),
    create: async (p, text) => {
      if (files.has(p)) throw new Error("File already exists.");
      files.set(p, text);
      indexed.add(p);
      created.push(p);
    },
    createFolder: async (p) => {
      if (folders.has(p)) throw new Error("Folder already exists.");
      folders.add(p);
      indexed.add(p);
      createdFolders.push(p);
    },
  };
  return { app: { vault }, files, folders, created, createdFolders };
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

test("io.write over a file or folder made outside Obsidian (on disk, not indexed) doesn't throw", async () => {
  const { app, files, folders, created, createdFolders } = fakeApp();
  files.set("Sessions/Session 1.md", "old");
  folders.add("Quests");
  const { io } = await lorekeeper(app);
  await io.write("Sessions/Session 1.md", "new");
  await io.write("Quests/Find the miners.md", "a");
  assert.equal(files.get("Sessions/Session 1.md"), "new");
  assert.equal(files.get("Quests/Find the miners.md"), "a");
  assert.deepEqual(createdFolders, []);
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
