const { test } = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto, createHash } = require("node:crypto");
const update = require("../_lorekeeper/lib/update.js");
const updater = require("../_lorekeeper/lib/updater.js");

const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");

function fakeAdapter(files) {
  const store = new Map(Object.entries(files));
  const order = [];
  return {
    store, order,
    exists: async (p) => store.has(p) || [...store.keys()].some((k) => k.startsWith(p + "/")),
    read: async (p) => { if (!store.has(p)) throw new Error("ENOENT " + p); return store.get(p); },
    write: async (p, t) => { order.push(p); store.set(p, t); },
    mkdir: async () => {},
    remove: async (p) => { order.push("rm " + p); store.delete(p); },
  };
}

function fakeRequest(remote, tag = "v0.2.0") {
  return async ({ url }) => {
    if (url === `https://api.github.com/repos/${updater.REPO}/releases/latest`) return { status: 200, json: { tag_name: tag } };
    const prefix = `https://raw.githubusercontent.com/${updater.REPO}/${tag}/`;
    if (url.startsWith(prefix)) {
      const p = url.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
      if (p in remote) return { status: 200, text: remote[p], json: (() => { try { return JSON.parse(remote[p]); } catch { return null; } })() };
    }
    return { status: 404, text: "", json: null };
  };
}

function release(remoteFiles, plugins) {
  const files = {};
  for (const [p, t] of Object.entries(remoteFiles)) {
    const kind = update.categorize(p);
    if (!kind) continue;
    if (!update.isSharedJson(p)) { files[p] = { sha256: sha(t), kind }; continue; }
    const parsed = JSON.parse(t);
    files[p] = { sha256: sha(update.canonical(parsed)), kind };
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) files[p].keys = Object.keys(parsed);
  }
  return { version: "0.2.0", plugins, files };
}

test("prepare reports already up to date", async () => {
  const rel = release({ "Home.md": "h" }, []);
  const adapter = fakeAdapter({ "_lorekeeper/installed.json": JSON.stringify({ version: "0.2.0", files: {}, plugins: [] }) });
  const out = await updater.prepare({ adapter, request: fakeRequest({ "lorekeeper.json": JSON.stringify(rel) }), subtle: webcrypto.subtle, update });
  assert.deepEqual(out, { latest: true, version: "0.2.0" });
});

test("prepare falls back to the v0.1.0 baseline", async () => {
  const remote = { "Home.md": "h2" };
  const rel = release(remote, []);
  const adapter = fakeAdapter({
    "_lorekeeper/baselines/v0.1.0.json": JSON.stringify({ version: "0.1.0", files: { "Home.md": sha("h1") }, plugins: [] }),
    "Home.md": "h1",
  });
  const out = await updater.prepare({ adapter, request: fakeRequest({ ...remote, "lorekeeper.json": JSON.stringify(rel) }), subtle: webcrypto.subtle, update });
  assert.equal(out.tag, "v0.2.0");
  assert.deepEqual(out.plan.replace, ["Home.md"]);
});

test("writes installed.json last and skips files that fail their hash", async () => {
  const remote = { "_lorekeeper/lib/a.js": "a2", "Cheat Sheet.md": "c2", ".obsidian/plugins/x/main.js": "x2" };
  const rel = release(remote, ["x"]);
  rel.files[".obsidian/plugins/x/main.js"].sha256 = sha("something else"); // tampered download
  const adapter = fakeAdapter({ "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", files: {}, plugins: [] }) });
  const request = fakeRequest({ ...remote, "lorekeeper.json": JSON.stringify(rel) });
  const prepared = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  const out = await updater.apply({ adapter, request, subtle: webcrypto.subtle, update, ...prepared });
  assert.deepEqual(out.failed, [".obsidian/plugins/x/main.js"]);
  assert.ok(!adapter.store.has(".obsidian/plugins/x/main.js"));
  assert.equal(adapter.store.get("Cheat Sheet.md"), "c2");
  assert.equal(JSON.parse(adapter.store.get("_lorekeeper/installed.json")).version, "0.1.0"); // not advanced
});

test("a clean update merges plugins and QuickAdd, records hashes, asks for reload", async () => {
  const qaRelease = JSON.stringify({ choices: [{ id: "lk-update", name: "Update Lorekeeper" }], migrations: {} });
  const remote = {
    ".obsidian/plugins/sl/main.js": "sl",
    ".obsidian/community-plugins.json": JSON.stringify(["quickadd", "sl"]),
    ".obsidian/plugins/quickadd/data.json": qaRelease,
  };
  const rel = release(remote, ["quickadd", "sl"]);
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", files: {}, plugins: ["quickadd"] }),
    ".obsidian/community-plugins.json": JSON.stringify(["quickadd", "obsidian-git"]),
    ".obsidian/plugins/quickadd/data.json": JSON.stringify({ choices: [{ id: "mine", name: "Mine" }], migrations: {} }),
  });
  const request = fakeRequest({ ...remote, "lorekeeper.json": JSON.stringify(rel) });
  const prepared = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  const out = await updater.apply({ adapter, request, subtle: webcrypto.subtle, update, ...prepared });
  assert.deepEqual(out.failed, []);
  assert.equal(out.reload, true);
  assert.deepEqual(JSON.parse(adapter.store.get(".obsidian/community-plugins.json")), ["quickadd", "obsidian-git", "sl"]);
  assert.deepEqual(JSON.parse(adapter.store.get(".obsidian/plugins/quickadd/data.json")).choices.map((c) => c.id), ["mine", "lk-update"]);
  const installed = JSON.parse(adapter.store.get("_lorekeeper/installed.json"));
  assert.equal(installed.version, "0.2.0");
  assert.deepEqual(installed.plugins, ["quickadd", "sl"]);
  assert.equal(installed.files[".obsidian/plugins/sl/main.js"], sha("sl"));
  assert.equal(adapter.order.at(-1), "_lorekeeper/installed.json");
});

test("rawUrl encodes each path segment", () => {
  assert.ok(update.rawUrl(updater.REPO, "v0.2.0", "Cheat Sheet.md").endsWith("/Cheat%20Sheet.md"));
});

const view = (obj, keys) => sha(update.jsonView(JSON.stringify(obj), keys));

test("an Obsidian-reformatted settings file counts as unedited", async () => {
  const keys = ["theme", "cssTheme", "baseFontSize"];
  const was = { theme: "obsidian", cssTheme: "Lorekeeper", baseFontSize: 16 };
  const remote = { ".obsidian/appearance.json": JSON.stringify({ ...was, baseFontSize: 18 }) };
  const rel = release(remote, []);
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], keys: { ".obsidian/appearance.json": keys }, files: { ".obsidian/appearance.json": view(was, keys) } }),
    ".obsidian/appearance.json": JSON.stringify({ ...was, accentColor: "#ff0000" }, null, 2),
  });
  const request = fakeRequest({ ...remote, "lorekeeper.json": JSON.stringify(rel) });
  const prepared = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  assert.deepEqual(prepared.plan.replace, [".obsidian/appearance.json"]);
  const out = await updater.apply({ adapter, request, subtle: webcrypto.subtle, update, ...prepared });
  assert.deepEqual(out.failed, []);
  const now = JSON.parse(adapter.store.get(".obsidian/appearance.json"));
  assert.equal(now.baseFontSize, 18);
  assert.equal(now.accentColor, "#ff0000");
  const installed = JSON.parse(adapter.store.get("_lorekeeper/installed.json"));
  assert.deepEqual(installed.keys[".obsidian/appearance.json"], keys);
});

test("a really edited settings key is kept", async () => {
  const keys = ["theme", "cssTheme", "baseFontSize"];
  const was = { theme: "obsidian", cssTheme: "Lorekeeper", baseFontSize: 16 };
  const remote = { ".obsidian/appearance.json": JSON.stringify({ ...was, baseFontSize: 18 }) };
  const rel = release(remote, []);
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], keys: { ".obsidian/appearance.json": keys }, files: { ".obsidian/appearance.json": view(was, keys) } }),
    ".obsidian/appearance.json": JSON.stringify({ ...was, cssTheme: "Mine" }, null, 2),
  });
  const request = fakeRequest({ ...remote, "lorekeeper.json": JSON.stringify(rel) });
  const prepared = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  assert.deepEqual(prepared.plan.kept, [".obsidian/appearance.json"]);
  assert.deepEqual(prepared.plan.replace, []);
});
