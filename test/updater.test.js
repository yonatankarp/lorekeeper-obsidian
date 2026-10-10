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
  assert.deepEqual(out.failed, [{ path: ".obsidian/plugins/x/main.js", reason: "download didn't match" }]);
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

const run = async (adapter, remote, rel) => {
  const request = fakeRequest({ ...remote, "lorekeeper.json": JSON.stringify(rel) }, rel.tag);
  const prepared = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  const out = prepared.latest ? null : await updater.apply({ adapter, request, subtle: webcrypto.subtle, update, ...prepared });
  return { prepared, out };
};

test("an edit you kept stays an edit on the next update", async () => {
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], files: { "Templates/NPC.md": sha("v1") } }),
    "Templates/NPC.md": "mine",
  });
  const r2 = { ...release({ "Templates/NPC.md": "v2" }, []), version: "0.2.0", tag: "v0.2.0" };
  const first = await run(adapter, { "Templates/NPC.md": "v2" }, r2);
  assert.deepEqual(first.prepared.plan.kept, ["Templates/NPC.md"]);
  const r3 = { ...release({ "Templates/NPC.md": "v3" }, []), version: "0.3.0", tag: "v0.3.0" };
  const second = await run(adapter, { "Templates/NPC.md": "v3" }, r3);
  assert.deepEqual(second.prepared.plan.kept, ["Templates/NPC.md"]);
  assert.equal(adapter.store.get("Templates/NPC.md"), "mine");
});

test("a tampered merge download fails and installed.json doesn't advance", async () => {
  const remote = { ".obsidian/community-plugins.json": JSON.stringify(["a"]) };
  const rel = release(remote, ["a"]);
  rel.files[".obsidian/community-plugins.json"].sha256 = sha("other");
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", files: {}, plugins: [] }),
    ".obsidian/community-plugins.json": JSON.stringify(["x"]),
  });
  const { out } = await run(adapter, remote, { ...rel, tag: "v0.2.0" });
  assert.deepEqual(out.failed, [{ path: ".obsidian/community-plugins.json", reason: "download didn't match" }]);
  assert.equal(JSON.parse(adapter.store.get("_lorekeeper/installed.json")).version, "0.1.0");
});

test("a throwing remove is reported as failed", async () => {
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], files: { "_lorekeeper/lib/old.js": sha("o") } }),
    "_lorekeeper/lib/old.js": "o",
  });
  adapter.remove = async () => { throw new Error("locked"); };
  const { out } = await run(adapter, {}, { ...release({}, []), tag: "v0.2.0" });
  assert.deepEqual(out.failed, [{ path: "_lorekeeper/lib/old.js", reason: "couldn't remove" }]);
  assert.equal(JSON.parse(adapter.store.get("_lorekeeper/installed.json")).version, "0.1.0");
});

test("reload is false for a template-only update, true when settings change", async () => {
  const a1 = fakeAdapter({ "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], files: {} }) });
  const t = await run(a1, { "Templates/A.md": "a" }, { ...release({ "Templates/A.md": "a" }, []), tag: "v0.2.0" });
  assert.equal(t.out.reload, false);
  const a2 = fakeAdapter({ "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], files: {} }) });
  const s = await run(a2, { ".obsidian/appearance.json": JSON.stringify({ theme: "x" }) }, { ...release({ ".obsidian/appearance.json": JSON.stringify({ theme: "x" }) }, []), tag: "v0.2.0" });
  assert.equal(s.out.reload, true);
});

test("an identical merge is not rewritten", async () => {
  const remote = { ".obsidian/community-plugins.json": JSON.stringify(["a"]) };
  const same = JSON.stringify(["a"], null, 2) + "\n";
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", files: {}, plugins: ["a"] }),
    ".obsidian/community-plugins.json": same,
  });
  const { out } = await run(adapter, remote, { ...release(remote, ["a"]), tag: "v0.2.0" });
  assert.deepEqual(out.written, []);
  assert.equal(out.reload, false);
});

// The real committed files, read from git (the working tree can hold the player's uncommitted settings).
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { filesAt } = require("../scripts/make-manifest.js");
const ROOT = path.join(__dirname, "..");
const gitShow = (spec) => execFileSync("git", ["show", spec], { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8");
const committed = (ref) => Object.fromEntries(filesAt(ref).map(({ path: p, text }) => [p, text.toString("utf8")]));

test("toInstalled converts a manifest-shaped record and leaves a flat one alone", () => {
  assert.equal(updater.toInstalled(null), null);
  const manifest = {
    version: "0.2.0", plugins: ["quickadd"],
    files: { "Home.md": { sha256: "aa", kind: "shared" }, ".obsidian/app.json": { sha256: "bb", kind: "shared", keys: ["x"] } },
  };
  assert.deepEqual(updater.toInstalled(manifest), {
    version: "0.2.0", plugins: ["quickadd"], files: { "Home.md": "aa", ".obsidian/app.json": "bb" }, keys: { ".obsidian/app.json": ["x"] },
  });
  const flat = { version: "0.1.0", plugins: [], keys: { "a.json": ["k"] }, files: { "Home.md": "aa" } };
  assert.equal(updater.toInstalled(flat), flat);
});

test("a fresh clone is up to date", async () => {
  const manifest = gitShow("HEAD:lorekeeper.json");
  const adapter = fakeAdapter({ ...committed("HEAD"), "lorekeeper.json": manifest });
  const request = fakeRequest({ "lorekeeper.json": manifest }, `v${JSON.parse(manifest).version}`);
  const out = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  assert.equal(out.latest, true);
});

test("a fresh clone's unedited shared file is replaced next release", async () => {
  const manifest = gitShow("HEAD:lorekeeper.json");
  const files = committed("HEAD");
  const rel = JSON.parse(manifest);
  rel.version = "0.3.0";
  const home = files["Home.md"] + "\nNew in 0.3.0.\n";
  rel.files["Home.md"].sha256 = sha(home);
  const adapter = fakeAdapter({ ...files, "lorekeeper.json": manifest });
  const request = fakeRequest({ ...files, "Home.md": home, "lorekeeper.json": JSON.stringify(rel) }, "v0.3.0");
  const out = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  assert.deepEqual(out.plan.replace, ["Home.md"]);
  assert.deepEqual(out.plan.kept, []);
  assert.deepEqual(out.plan.add, []);
  assert.deepEqual(out.plan.remove, []);
});

test("an untouched v0.1.0 vault replaces Cheat Sheet.md", async () => {
  const old = committed("71dc24b");
  assert.ok(!("lorekeeper.json" in old) && !("_lorekeeper/installed.json" in old));
  const now = committed("HEAD");
  assert.notEqual(old["Cheat Sheet.md"], now["Cheat Sheet.md"]);
  const manifest = gitShow("HEAD:lorekeeper.json");
  const adapter = fakeAdapter({ ...old, "_lorekeeper/baselines/v0.1.0.json": gitShow("HEAD:_lorekeeper/baselines/v0.1.0.json") });
  const request = fakeRequest({ ...now, "lorekeeper.json": manifest }, `v${JSON.parse(manifest).version}`);
  const out = await updater.prepare({ adapter, request, subtle: webcrypto.subtle, update });
  assert.ok(out.plan.replace.includes("Cheat Sheet.md"));
  assert.ok(!out.plan.kept.includes("Cheat Sheet.md"));
  assert.deepEqual(out.plan.kept, []);
});

test("never downgrades: an installed version newer than the release is up to date", async () => {
  const rel = { ...release({ "Home.md": "h" }, []), version: "0.2.0" };
  const adapter = fakeAdapter({ "_lorekeeper/installed.json": JSON.stringify({ version: "0.3.0", files: {}, plugins: [] }), "Home.md": "x" });
  const out = await updater.prepare({ adapter, request: fakeRequest({ "lorekeeper.json": JSON.stringify(rel) }), subtle: webcrypto.subtle, update });
  assert.deepEqual(out, { latest: true, version: "0.3.0" });
  const ten = fakeAdapter({ "_lorekeeper/installed.json": JSON.stringify({ version: "0.10.0", files: {}, plugins: [] }) });
  const out2 = await updater.prepare({ adapter: ten, request: fakeRequest({ "lorekeeper.json": JSON.stringify({ ...rel, version: "0.9.0" }) }), subtle: webcrypto.subtle, update });
  assert.equal(out2.latest, true);
});

test("a failed file says why: invalid JSON, a missing download", async () => {
  const qa = JSON.stringify({ choices: [{ id: "lk-update", name: "Update Lorekeeper" }], migrations: {} });
  const remote = { ".obsidian/plugins/quickadd/data.json": qa, ".obsidian/appearance.json": JSON.stringify({ theme: "y" }), "Templates/A.md": "a" };
  const rel = { ...release(remote, []), tag: "v0.2.0" };
  const adapter = fakeAdapter({
    "_lorekeeper/installed.json": JSON.stringify({ version: "0.1.0", plugins: [], files: { ".obsidian/appearance.json": sha("{ broken") } }),
    ".obsidian/plugins/quickadd/data.json": "{ not json",
    ".obsidian/appearance.json": "{ broken",
  });
  const served = { ...remote };
  delete served["Templates/A.md"];
  const { out } = await run(adapter, served, rel);
  assert.deepEqual(out.failed, [
    { path: "Templates/A.md", reason: "couldn't download" },
    { path: ".obsidian/appearance.json", reason: "isn't valid JSON" },
    { path: ".obsidian/plugins/quickadd/data.json", reason: "isn't valid JSON" },
  ]);
  assert.equal(adapter.store.get(".obsidian/plugins/quickadd/data.json"), "{ not json");
});
