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

// Party mode: your own file inside a shared session.
const party = require("../_lorekeeper/lib/party.js");
const PART = "_lorekeeper/templates/session-part.md";

function partVault() {
  const v = vault();
  fs.copyFileSync(path.join(ROOT, PART), path.join(v.dir, PART));
  return v;
}
const touch = (dir, p, msAgo) => {
  const t = (AT.getTime() - msAgo) / 1000;
  fs.utimesSync(path.join(dir, p), t, t);
};

test("startPart makes the view page and your file, never overwriting", async () => {
  const { dir, io } = partVault();
  const p = await s.startPart(io, party, 4, "Vex", AT);
  assert.equal(p, "Sessions/Session 4/Vex.md");
  assert.ok(fs.existsSync(path.join(dir, "Sessions/Session 4.md")));
  assert.equal(await io.read(p), '---\nsession: 4\ndate: 2026-10-10\nauthor: "[[Vex]]"\n---\n## Notes\n\n');
  await io.write(p, "mine\n");
  await s.startPart(io, party, 4, "Vex", AT);
  assert.equal(await io.read(p), "mine\n");
});

test("startPart writes author DM for the DM", async () => {
  const { io } = partVault();
  const p = await s.startPart(io, party, 2, "DM", AT);
  assert.match(await io.read(p), /\nauthor: DM\n/);
});

test("startPart can make your private session file", async () => {
  const { dir, io } = partVault();
  const p = await s.startPart(io, party, 3, "Vex", AT, { privateFile: true });
  assert.equal(p, "Private/Vex/Sessions/Session 3.md");
  assert.match(await io.read(p), /\nauthor: "\[\[Vex\]\]"\n/);
  assert.ok(fs.existsSync(path.join(dir, "Sessions/Session 3.md")));
});

test("ensureSession is startSession", async () => {
  const { io } = partVault();
  assert.equal(await s.ensureSession(io, 1, AT), "Sessions/Session 1.md");
});

test("currentParty: nothing yet, then mine and teammates decide quiet", async () => {
  const { dir, io } = partVault();
  const now = AT.getTime();
  assert.deepEqual(await s.currentParty(io, party, "Vex", now), { n: 0, path: null, quiet: false });
  await s.startPart(io, party, 2, "Halia", AT);
  touch(dir, "Sessions/Session 2/Halia.md", 1 * 3600e3);
  // a teammate wrote recently and I haven't: not quiet
  assert.deepEqual(await s.currentParty(io, party, "Vex", now), { n: 2, path: "Sessions/Session 2/Vex.md", quiet: false });
  // my own file decides once it exists
  await s.startPart(io, party, 2, "Vex", AT);
  touch(dir, "Sessions/Session 2/Vex.md", 13 * 3600e3);
  assert.equal((await s.currentParty(io, party, "Vex", now)).quiet, true);
});

test("currentParty: everyone quiet means quiet; a folder-only session isn't", async () => {
  const { dir, io } = partVault();
  const now = AT.getTime();
  await s.startPart(io, party, 2, "Halia", AT);
  touch(dir, "Sessions/Session 2/Halia.md", 20 * 3600e3);
  assert.equal((await s.currentParty(io, party, "Vex", now)).quiet, true);
  fs.mkdirSync(path.join(dir, "Sessions/Session 6"), { recursive: true });
  assert.deepEqual(await s.currentParty(io, party, "Vex", now), { n: 6, path: "Sessions/Session 6/Vex.md", quiet: true });
});

test("newSessionNumber joins a session teammates are writing in, else starts the next", async () => {
  const { dir, io } = partVault();
  const now = AT.getTime();
  assert.equal(await s.newSessionNumber(io, party, "Vex", now), 1);
  await s.startPart(io, party, 2, "Halia", AT);
  touch(dir, "Sessions/Session 2/Halia.md", 1 * 3600e3);
  assert.equal(await s.newSessionNumber(io, party, "Vex", now), 2);
  await s.startPart(io, party, 2, "Vex", AT);
  touch(dir, "Sessions/Session 2/Vex.md", 1 * 3600e3);
  assert.equal(await s.newSessionNumber(io, party, "Vex", now), 3);
  assert.equal(await s.newSessionNumber(io, party, "Halia", now), 3);
  assert.equal(await s.newSessionNumber(io, party, "Dara", now), 2);
  touch(dir, "Sessions/Session 2/Halia.md", 13 * 3600e3);
  touch(dir, "Sessions/Session 2/Vex.md", 13 * 3600e3);
  assert.equal(await s.newSessionNumber(io, party, "Dara", now), 3);
});
