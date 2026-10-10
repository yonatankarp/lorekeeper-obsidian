const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const s = require("../_lorekeeper/lib/session.js");
const makeIO = require("./helpers/io.js");

const ROOT = path.join(__dirname, "..");
const AT = new Date(2026, 9, 10, 20, 5); // 2026-10-10 20:05 local

function vault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lk vault "));
  fs.mkdirSync(path.join(dir, "_lorekeeper/templates"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, s.TEMPLATE), path.join(dir, s.TEMPLATE));
  return { dir, io: makeIO(dir) };
}

test("latestSession numbers, not names", () => {
  assert.equal(s.latestSession([]), 0);
  assert.equal(s.latestSession(["Session 9.md", "Session 10.md", "Session 2"]), 10);
  assert.equal(s.latestSession(["Session 3", "Session notes.md", "Session 4.txt", ".DS_Store"]), 3);
});

test("isQuiet after 12 hours", () => {
  const now = AT.getTime();
  assert.equal(s.isQuiet(now - 12 * 3600e3, now), false);
  assert.equal(s.isQuiet(now - 12 * 3600e3 - 1, now), true);
});

test("noteLine collapses whitespace", () => {
  assert.equal(s.noteLine("  @Mirela,\n  shifty\tinnkeeper  ", AT), "- 20:05 @Mirela, shifty innkeeper");
  assert.equal(s.noteLine(" \n\t ", AT), null);
  assert.equal(s.clock(new Date(2026, 0, 2, 7, 3)), "07:03");
  assert.equal(s.isoDate(new Date(2026, 0, 2, 7, 3)), "2026-01-02");
});

test("appends after a missing newline", () => {
  assert.equal(s.appendLine("## Notes\n", "- 20:05 A"), "## Notes\n- 20:05 A\n");
  assert.equal(s.appendLine("- 20:00 typed by hand", "- 20:05 A"), "- 20:00 typed by hand\n- 20:05 A\n");
  assert.equal(s.appendLine("", "- 20:05 A"), "- 20:05 A\n");
});

test("renderSession fills the template", () => {
  const out = s.renderSession(fs.readFileSync(path.join(ROOT, s.TEMPLATE), "utf8"), 7, "2026-10-10");
  assert.match(out, /^---\nsession: 7\ndate: 2026-10-10\n/);
  assert.ok(out.includes('dv.view("_lorekeeper/scripts/session"'));
  assert.ok(out.endsWith("## Notes\n\n"));
});

test("no sessions yet: currentSession is 0, the first note starts Session 1", async () => {
  const { dir, io } = vault();
  assert.deepEqual(await s.currentSession(io, AT.getTime()), { n: 0, path: null, quiet: false });
  const p = await s.startSession(io, 1, AT);
  assert.equal(p, "Sessions/Session 1.md");
  assert.equal(await s.addNote(io, p, "We set out", AT), "- 20:05 We set out");
  assert.ok(fs.readFileSync(path.join(dir, p), "utf8").endsWith("## Notes\n\n- 20:05 We set out\n"));
});

test("startSession never overwrites", async () => {
  const { dir, io } = vault();
  await io.write("Sessions/Session 2.md", "mine\n");
  await s.startSession(io, 2, AT);
  assert.equal(fs.readFileSync(path.join(dir, "Sessions/Session 2.md"), "utf8"), "mine\n");
});

test("currentSession reports a quiet session", async () => {
  const { dir, io } = vault();
  await io.write("Sessions/Session 3.md", "x\n");
  const old = (AT.getTime() - 13 * 3600e3) / 1000;
  fs.utimesSync(path.join(dir, "Sessions/Session 3.md"), old, old);
  assert.deepEqual(await s.currentSession(io, AT.getTime()), { n: 3, path: "Sessions/Session 3.md", quiet: true });
});

test("a folder-only session counts and isn't quiet", async () => {
  const { dir, io } = vault();
  fs.mkdirSync(path.join(dir, "Sessions/Session 5"), { recursive: true });
  assert.deepEqual(await s.currentSession(io, AT.getTime()), { n: 5, path: "Sessions/Session 5.md", quiet: false });
});

test("addNote ignores an empty note", async () => {
  const { io } = vault();
  const p = await s.startSession(io, 1, AT);
  const before = await io.read(p);
  assert.equal(await s.addNote(io, p, "   ", AT), null);
  assert.equal(await io.read(p), before);
});
