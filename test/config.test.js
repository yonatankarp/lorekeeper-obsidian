const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const json = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

test("every enabled plugin is pinned and downloaded", () => {
  const pinned = fs.readFileSync(path.join(ROOT, "plugin-versions.txt"), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(" "));
  assert.deepEqual(json(".obsidian/community-plugins.json").sort(), pinned.map(([id]) => id).sort());
  for (const [id, , version, manifest] of pinned) assert.equal(json(`.obsidian/plugins/${id}/manifest.json`).version, manifest || version, id);
});

test("every folder template exists", () => {
  for (const { template } of json(".obsidian/plugins/templater-obsidian/data.json").folder_templates)
    assert.ok(fs.existsSync(path.join(ROOT, template)), template);
});

test("selectors match the templates' starting values", () => {
  const sel = Object.fromEntries(json(".obsidian/plugins/custom-selectors/data.json").selectors.map((s) => [s.name, s.options]));
  assert.ok(sel.status.includes("open") && fs.readFileSync(path.join(ROOT, "Templates/Quest.md"), "utf8").includes("status: open"));
  assert.ok(sel.condition.includes("alive") && fs.readFileSync(path.join(ROOT, "Templates/NPC.md"), "utf8").includes("condition: alive"));
});

test("Home embeds only bases that exist", () => {
  const home = fs.readFileSync(path.join(ROOT, "Home.md"), "utf8");
  const embeds = [...home.matchAll(/!\[\[([^\]#|]+)/g)].map((m) => m[1]);
  assert.equal(embeds.length, 3);
  for (const e of embeds) assert.ok(fs.existsSync(path.join(ROOT, e)), e);
});

test("Templater settings are in the v2 format, so nothing is migrated on first load", () => {
  const data = json(".obsidian/plugins/templater-obsidian/data.json");
  assert.equal(data.data_version, 2);
  assert.ok(!("trigger_on_file_creation" in data));
  assert.equal(data.trigger_on_file_creation_mode, "folder");
  assert.ok(data.ignore_folders_on_creation.length > 0);
  for (const entry of data.ignore_folders_on_creation) assert.ok(entry && typeof entry === "object" && entry.folder, JSON.stringify(entry));
});

test("every built-in template has its folder template", () => {
  const folders = { PC: "PCs", NPC: "NPCs", Location: "Locations", Item: "Items", Faction: "Factions", Quest: "Quests", Lore: "Lore" };
  const pairs = json(".obsidian/plugins/templater-obsidian/data.json").folder_templates;
  for (const file of fs.readdirSync(path.join(ROOT, "Templates"))) {
    const kind = file.replace(/\.md$/, "");
    if (!(kind in folders)) continue;
    assert.ok(pairs.some((p) => p.folder === folders[kind] && p.template === `Templates/${file}`), kind);
  }
});
