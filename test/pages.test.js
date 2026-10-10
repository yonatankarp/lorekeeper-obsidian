const { test } = require("node:test");
const assert = require("node:assert/strict");
const { kinds, folderFor, nameProblem } = require("../_lorekeeper/lib/pages.js");

test("kinds: built-ins in Lorekeeper's order, then custom ones by name", () => {
  assert.deepEqual(
    kinds(["Quest.md", "Monster.md", "NPC.md", "PC.md", "Lore.md", "Item.md", "Faction.md", "Location.md", "Deity.md", "notes.txt"]),
    ["PC", "NPC", "Location", "Item", "Faction", "Quest", "Lore", "Deity", "Monster"],
  );
});

test("folderFor: built-in folders, then Monsters or Monster, else the root", () => {
  assert.equal(folderFor("NPC", []), "NPCs");
  assert.equal(folderFor("Lore", []), "Lore");
  assert.equal(folderFor("Monster", ["Monsters", "Monster"]), "Monsters");
  assert.equal(folderFor("Monster", ["Monster"]), "Monster");
  assert.equal(folderFor("Monster", []), "");
});

test("nameProblem", () => {
  assert.equal(nameProblem("Mirela", ["Vex"]), null);
  assert.equal(nameProblem("  ", []), "Type a name.");
  assert.equal(nameProblem("A/B", []), 'A name can\'t use / \\ : * ? " < > |');
  assert.equal(nameProblem(".hidden", []), "A name can't start or end with a dot.");
  assert.equal(nameProblem("end.", []), "A name can't start or end with a dot.");
  assert.equal(nameProblem("mirela", ["Mirela"]), "There's already a page called Mirela.");
});
