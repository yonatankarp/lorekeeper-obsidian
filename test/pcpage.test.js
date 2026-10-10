const { test } = require("node:test");
const assert = require("node:assert/strict");
const p = require("../_lorekeeper/lib/pcpage.js");

const c = { id: 5, name: "Demus", race: "Hill Dwarf", classes: "Fighter (Champion)", level: 4, player: "demus_player",
  url: "https://www.dndbeyond.com/characters/5", background: "Folk Hero", alignment: "", appearance: "Age 52", personality: "**Ideals:** Family." };

test("pcPageFor: the sheet link wins, else the name if it links nowhere else", () => {
  const notes = [
    { path: "PCs/Demus.md", dndbeyond: "https://www.dndbeyond.com/characters/99" },
    { path: "PCs/Old Demus.md", dndbeyond: "https://www.dndbeyond.com/characters/5" },
    { path: "NPCs/Demus.md", dndbeyond: "" },
  ];
  assert.equal(p.pcPageFor(c, notes), "PCs/Old Demus.md");
  assert.equal(p.pcPageFor(c, [{ path: "PCs/demus.md", dndbeyond: "" }]), "PCs/demus.md");
  assert.equal(p.pcPageFor(c, [{ path: "PCs/Demus.md", dndbeyond: "https://www.dndbeyond.com/characters/99" }]), null);
  assert.equal(p.pcPageFor(c, []), null);
});

test("safePageName", () => {
  assert.equal(p.safePageName("Vex: the [Bold] #1", "Character 6"), "Vex the Bold 1");
  assert.equal(p.safePageName("...", "Character 6"), "Character 6");
});

test("fillSection writes only into an empty section, or adds it before Notes", () => {
  const md = "## Appearance\n\n## Personality\nAlready here.\n\n## Notes\n";
  const out = p.fillSection(p.fillSection(md, "Appearance", "Age 52"), "Personality", "New");
  assert.equal(out, "## Appearance\n\nAge 52\n\n## Personality\nAlready here.\n\n## Notes\n");
  assert.equal(p.fillSection("## Notes\n", "Goals", "x"), "## Goals\n\nx\n\n## Notes\n");
  assert.equal(p.fillSection("Body", "Goals", "x"), "Body\n\n## Goals\n\nx\n");
  assert.equal(p.fillSection("## Goals\n", "Goals", ""), "## Goals\n");
});

test("applyCharacter replaces sheet fields, fills player and portrait only when empty, skips blanks", () => {
  const fm = { type: "pc", race: "Dwarf", class: "", level: 1, player: "Dana", portrait: "", alignment: "Lawful Good", mood: "grumpy" };
  p.applyCharacter(fm, c, "[[Demus.jpg]]");
  assert.deepEqual(fm, { type: "pc", race: "Hill Dwarf", class: "Fighter (Champion)", level: 4, player: "Dana", portrait: "[[Demus.jpg]]",
    alignment: "Lawful Good", mood: "grumpy", background: "Folk Hero", dndbeyond: "https://www.dndbeyond.com/characters/5" });
  const fresh = {};
  p.applyCharacter(fresh, c);
  assert.equal(fresh.player, "demus_player");
  assert.ok(!("portrait" in fresh));
});
