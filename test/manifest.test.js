const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { buildManifest } = require("../scripts/make-manifest.js");

const ROOT = path.join(__dirname, "..");

test("buildManifest keeps only categorised files, hashed, and lists enabled plugins", () => {
  const m = buildManifest({ version: "9.9.9", files: [
    { path: "_lorekeeper/lib/a.js", text: "a" },
    { path: "Home.md", text: "h" },
    { path: "README.md", text: "r" },
    { path: ".obsidian/community-plugins.json", text: '["quickadd"]' },
  ] });
  assert.equal(m.version, "9.9.9");
  assert.deepEqual(Object.keys(m.files).sort(), [".obsidian/community-plugins.json", "Home.md", "_lorekeeper/lib/a.js"]);
  assert.deepEqual(m.files["_lorekeeper/lib/a.js"], { sha256: createHash("sha256").update("a").digest("hex"), kind: "managed" });
  assert.deepEqual(m.plugins, ["quickadd"]);
});

test("lorekeeper.json matches the tree and package.json's version", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "lorekeeper.json"), "utf8"));
  assert.equal(m.version, require("../package.json").version);
  for (const [p, { sha256 }] of Object.entries(m.files))
    assert.equal(createHash("sha256").update(fs.readFileSync(path.join(ROOT, p))).digest("hex"), sha256, p);
});

test("the v0.1.0 baseline exists and describes M1", () => {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, "_lorekeeper/baselines/v0.1.0.json"), "utf8"));
  assert.equal(b.version, "0.1.0");
  assert.ok(b.files["_lorekeeper/lib/notes.js"]);
  assert.ok(!b.files["_lorekeeper/lib/update.js"]);
  assert.deepEqual(b.plugins.sort(), ["custom-selectors", "dataview", "quickadd", "templater-obsidian"]);
});
