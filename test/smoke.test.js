const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("every campaign folder exists", () => {
  for (const d of ["Sessions", "PCs", "NPCs", "Locations", "Items", "Factions", "Quests", "Lore", "Attachments"])
    assert.ok(fs.statSync(path.join(root, d)).isDirectory(), d);
});
