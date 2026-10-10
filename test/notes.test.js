const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SECTIONS, notesOf, journal, merge, mergeWithPrivate, sessionNumber, portraitTarget } = require("../_lorekeeper/lib/notes.js");

const SESSION = `---
session: 4
date: 2026-10-10
cssclasses:
  - lk-session
---
\`\`\`dataviewjs
await dv.view("_lorekeeper/scripts/session", { file: dv.current().file.path })
\`\`\`

## Notes

- 20:05 We reach Phandalin
- 20:07 @[[Mirela]] shifty innkeeper
- 20:09 #50 gp and a silver ring
- 20:11 !Find the missing miners
- 20:12 ?Who sent the letter
- 20:15 "Never trust a dwarf with a map"
- 20:16 “Curly quotes count too”
- 20:20 ![[map.png]]
`;

test("files each note by its first character", () => {
  assert.deepEqual(notesOf(SESSION).map((n) => [n.time, n.kind, n.text]), [
    ["20:05", "event", "We reach Phandalin"],
    ["20:07", "npc", "[[Mirela]] shifty innkeeper"],
    ["20:09", "loot", "50 gp and a silver ring"],
    ["20:11", "quest", "Find the missing miners"],
    ["20:12", "mystery", "Who sent the letter"],
    ["20:15", "quote", '"Never trust a dwarf with a map"'],
    ["20:16", "quote", "“Curly quotes count too”"],
    ["20:20", "event", "![[map.png]]"],
  ]);
});

test("skips fenced code and headings", () => {
  const texts = notesOf(SESSION).map((n) => n.text);
  assert.ok(!texts.some((t) => t.includes("dv.view") || t.includes("Notes")));
});

test("a bullet with only a time is not a note", () => {
  assert.deepEqual(notesOf("- 20:05 \n- 20:06\n- 21:00 Real one\n"), [{ time: "21:00", kind: "event", text: "Real one" }]);
});

test("hand-written lines and untimed bullets count", () => {
  assert.deepEqual(notesOf("The party rests.\n* @Vex returns\n---\n"), [
    { time: "", kind: "event", text: "The party rests." },
    { time: "", kind: "npc", text: "Vex returns" },
  ]);
});

test("a time glued to text is just text", () => {
  assert.deepEqual(notesOf("- 20:05pm dinner\n"), [{ time: "", kind: "event", text: "20:05pm dinner" }]);
});

test("a #tag line that isn't a heading is loot", () => {
  assert.deepEqual(notesOf("#sword of the north\n# Heading\n### Sub\n"), [{ time: "", kind: "loot", text: "sword of the north" }]);
});

test("journal groups by kind, every section present", () => {
  const groups = journal(notesOf(SESSION));
  assert.deepEqual(Object.keys(groups), SECTIONS.map(([k]) => k));
  assert.deepEqual(groups.npc, ["[[Mirela]] shifty innkeeper"]);
  assert.equal(groups.event.length, 2);
});

test("merge orders notes from several files by time, with authors", () => {
  const merged = merge([
    { author: "", text: "- 20:00 Start\n- 20:10 Fight\n" },
    { author: "Sibling 5", text: "- 20:05 @Vex winks\n" },
  ]);
  assert.deepEqual(merged.map((n) => [n.time, n.author, n.text]), [
    ["20:00", "", "Start"],
    ["20:05", "Sibling 5", "Vex winks"],
    ["20:10", "", "Fight"],
  ]);
});

test("keeps order across midnight", () => {
  const merged = merge([{ author: "", text: "- 23:50 Late\n- 00:10 Later\n- 9:05 Next morning\n" }]);
  assert.deepEqual(merged.map((n) => n.text), ["Late", "Later", "Next morning"]);
});

test("untimed notes stay after the note before them", () => {
  const merged = merge([
    { author: "", text: "- 20:00 A\nB without time\n- 20:30 C\n" },
    { author: "X", text: "- 20:10 D\n" },
  ]);
  assert.deepEqual(merged.map((n) => n.text), ["A", "B without time", "D", "C"]);
});

test("a small step back in time is not midnight", () => {
  const merged = merge([
    { author: "", text: "- 20:10 A\n- 20:05 B\n" },
    { author: "X", text: "- 20:07 C\n- 20:20 D\n" },
  ]);
  assert.deepEqual(merged.map((n) => n.text), ["B", "C", "A", "D"]);
});

test("mergeWithPrivate flags private notes and leaves shared ones unflagged", () => {
  const out = mergeWithPrivate([{ author: "Demus", text: "- 20:05 shared" }], [{ author: "Mirela", text: "- 20:03 secret" }]);
  assert.deepEqual(out, [
    { time: "20:03", kind: "event", text: "secret", author: "Mirela", private: true },
    { time: "20:05", kind: "event", text: "shared", author: "Demus" },
  ]);
  assert.deepEqual(mergeWithPrivate([{ author: "", text: "- 20:01 a" }], []), [{ time: "20:01", kind: "event", text: "a", author: "" }]);
});

test("sessionNumber reads N from Session N.md", () => {
  assert.equal(sessionNumber("Sessions/Session 12.md"), 12);
  assert.equal(sessionNumber("Sessions/Other.md"), 0);
});

test("portraitTarget handles embeds, links and paths", () => {
  assert.equal(portraitTarget("[[Demus.jpg]]"), "Demus.jpg");
  assert.equal(portraitTarget("![[img/Demus.jpg|100]]"), "img/Demus.jpg");
  assert.equal(portraitTarget("img/Demus.jpg"), "img/Demus.jpg");
  assert.equal(portraitTarget(undefined), "");
});
