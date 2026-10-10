const { test } = require("node:test");
const assert = require("node:assert/strict");
const nodePath = require("node:path");
const identity = require("../_lorekeeper/lib/identity.js");
const party = require("../_lorekeeper/lib/party.js");

const VAULT = "/Users/me/Vault";
const TSV = "/home/me/.config/lorekeeper/me.tsv";

function fakeApp(initial) {
  const store = new Map(initial === undefined ? [] : [[identity.KEY, initial]]);
  return {
    store,
    vault: { adapter: { basePath: VAULT } },
    loadLocalStorage: (k) => store.get(k) ?? null,
    saveLocalStorage: (k, v) => (v === null ? store.delete(k) : store.set(k, v)),
  };
}

function fakeFs(files = {}, { failWrite = false } = {}) {
  const dirs = [];
  return {
    files, dirs,
    readFileSync(p) { if (!(p in files)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); return files[p]; },
    writeFileSync(p, t) { if (failWrite) throw new Error("EACCES: permission denied"); files[p] = t; },
    mkdirSync(p, o) { dirs.push([p, o]); },
  };
}

const os = { homedir: () => "/home/me" };
const deps = (fs, desktop = true) => ({ fs, os, path: nodePath.posix, desktop, party });

test("me is empty until picked", () => {
  assert.equal(identity.me(fakeApp()), "");
  assert.equal(identity.me(fakeApp("Vex")), "Vex");
});

test("setMe stores the name and writes the tsv, creating the folder", async () => {
  const app = fakeApp();
  const fs = fakeFs();
  assert.equal(await identity.setMe(app, "Vex", deps(fs)), "");
  assert.equal(identity.me(app), "Vex");
  assert.equal(fs.files[TSV], `${VAULT}\tVex\n`);
  assert.deepEqual(fs.dirs, [["/home/me/.config/lorekeeper", { recursive: true }]]);
});

test("setMe replaces this vault's line and keeps others", async () => {
  const fs = fakeFs({ [TSV]: `/other\tDM\n${VAULT}\tVex\n` });
  await identity.setMe(fakeApp("Vex"), "DM", deps(fs));
  assert.equal(fs.files[TSV], `/other\tDM\n${VAULT}\tDM\n`);
});

test("setMe with an empty name clears localStorage and removes the line", async () => {
  const app = fakeApp("Vex");
  const fs = fakeFs({ [TSV]: `${VAULT}\tVex\n` });
  await identity.setMe(app, "", deps(fs));
  assert.equal(app.store.has(identity.KEY), false);
  assert.equal(identity.me(app), "");
  assert.equal(fs.files[TSV], "");
});

test("not on desktop, or with no fs, the file is untouched", async () => {
  const fs = fakeFs();
  const app = fakeApp();
  assert.equal(await identity.setMe(app, "Vex", deps(fs, false)), "");
  assert.deepEqual(fs.files, {});
  assert.equal(identity.me(app), "Vex");
  assert.equal(await identity.setMe(app, "Mira", { desktop: true, party }), "");
  assert.equal(identity.me(app), "Mira");
});

test("a file error is returned as a warning and the choice still applies", async () => {
  const app = fakeApp();
  const warning = await identity.setMe(app, "Vex", deps(fakeFs({}, { failWrite: true })));
  assert.equal(warning, "EACCES: permission denied");
  assert.equal(identity.me(app), "Vex");
});
