const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { buildManifest } = require("../scripts/make-manifest.js");
const { canonical, isSharedJson } = require("../_lorekeeper/lib/update.js");

const ROOT = path.join(__dirname, "..");
const sha = (text) => createHash("sha256").update(text).digest("hex");
const indexed = (p) => execFileSync("git", ["show", `:${p}`], { cwd: ROOT, maxBuffer: 1 << 28 });

test("buildManifest keeps only categorised files, hashed, and lists enabled plugins", () => {
  const m = buildManifest({ version: "9.9.9", files: [
    { path: "_lorekeeper/lib/a.js", text: "a" },
    { path: "Home.md", text: "h" },
    { path: "README.md", text: "r" },
    { path: ".obsidian/community-plugins.json", text: '["quickadd"]' },
  ] });
  assert.equal(m.version, "9.9.9");
  assert.deepEqual(Object.keys(m.files).sort(), [".obsidian/community-plugins.json", "Home.md", "_lorekeeper/lib/a.js"]);
  assert.deepEqual(m.files["_lorekeeper/lib/a.js"], { sha256: sha("a"), kind: "managed" });
  assert.deepEqual(m.plugins, ["quickadd"]);
});

test("a shared JSON object is hashed canonically and records its keys", () => {
  const text = '{\n "theme": "system",\n "x": 1\n}';
  const m = buildManifest({ version: "9.9.9", files: [{ path: ".obsidian/appearance.json", text }] });
  assert.deepEqual(m.files[".obsidian/appearance.json"], {
    sha256: sha(canonical(JSON.parse(text))), kind: "shared", keys: ["theme", "x"],
  });
});

test("a shared JSON array is hashed canonically with no keys", () => {
  const m = buildManifest({ version: "9.9.9", files: [{ path: ".obsidian/community-plugins.json", text: '["quickadd"]' }] });
  assert.deepEqual(m.files[".obsidian/community-plugins.json"], { sha256: sha('["quickadd"]'), kind: "shared" });
});

test("lorekeeper.json matches the index and package.json's version", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "lorekeeper.json"), "utf8"));
  assert.equal(m.version, require("../package.json").version);
  for (const [p, { sha256, kind, keys }] of Object.entries(m.files)) {
    const text = indexed(p);
    const expected = isSharedJson(p) ? sha(canonical(JSON.parse(text))) : sha(text);
    assert.equal(expected, sha256, p);
    if (isSharedJson(p) && Array.isArray(JSON.parse(text)) === false) assert.deepEqual(keys, Object.keys(JSON.parse(text)), p);
    assert.ok(kind === "managed" || kind === "shared", p);
  }
});

test("the committed appearance.json manifest entry lists its keys", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "lorekeeper.json"), "utf8"));
  assert.deepEqual(m.files[".obsidian/appearance.json"].keys, ["theme", "cssTheme", "baseFontSize"]);
});

test("the v0.1.0 baseline exists and describes M1", () => {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, "_lorekeeper/baselines/v0.1.0.json"), "utf8"));
  assert.equal(b.version, "0.1.0");
  assert.ok(b.files["_lorekeeper/lib/notes.js"]);
  assert.ok(!b.files["_lorekeeper/lib/update.js"]);
  assert.deepEqual(b.plugins.sort(), ["custom-selectors", "dataview", "quickadd", "templater-obsidian"]);
});

test("line endings are normalised and woff2 is binary", () => {
  const attrs = (p) => execFileSync("git", ["check-attr", "eol", "text", "binary", "--", p], { cwd: ROOT }).toString();
  assert.match(attrs("_lorekeeper/lib/update.js"), /text: auto/);
  assert.match(attrs("_lorekeeper/lib/update.js"), /eol: lf/);
  assert.match(attrs("fonts/Lorekeeper.woff2"), /binary: set/);
});
