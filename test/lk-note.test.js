const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "_lorekeeper/capture/lk-note");
const LINE = /^- \d{2}:\d{2} /;

function vault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lk vault "));
  fs.mkdirSync(path.join(dir, "_lorekeeper/templates"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "_lorekeeper/templates/session.md"), path.join(dir, "_lorekeeper/templates/session.md"));
  return dir;
}
const run = (dir, args, input) =>
  spawnSync("sh", [SCRIPT, "--vault", dir, ...args], { encoding: "utf8", input, env: { ...process.env, LK_NO_DIALOG: "1" } });
const read = (dir, n) => fs.readFileSync(path.join(dir, `Sessions/Session ${n}.md`), "utf8");
const lastLine = (text) => text.trimEnd().split("\n").pop();
const age = (dir, n, hours) => {
  const t = Date.now() / 1000 - hours * 3600;
  fs.utimesSync(path.join(dir, `Sessions/Session ${n}.md`), t, t);
};

test("vault path with spaces: the first note starts Session 1", () => {
  const dir = vault();
  const r = run(dir, ["@Mirela,", "shifty", "innkeeper"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Sessions/Session 1.md"));
  const text = read(dir, 1);
  assert.match(text, /^---\nsession: 1\ndate: \d{4}-\d{2}-\d{2}\n/);
  assert.match(lastLine(text), LINE);
  assert.ok(lastLine(text).endsWith(" @Mirela, shifty innkeeper"));
});

test("multi-line stdin becomes one line", () => {
  const dir = vault();
  assert.equal(run(dir, ["--stdin"], "  first line\n\n  second\tline \n").status, 0);
  assert.ok(lastLine(read(dir, 1)).endsWith(" first line second line"));
});

test("numeric order: Session 10 beats Session 9", () => {
  const dir = vault();
  fs.mkdirSync(path.join(dir, "Sessions"));
  fs.writeFileSync(path.join(dir, "Sessions/Session 9.md"), "nine\n");
  fs.writeFileSync(path.join(dir, "Sessions/Session 10.md"), "ten");
  fs.writeFileSync(path.join(dir, "Sessions/Session notes.md"), "x\n");
  assert.equal(run(dir, ["hi"]).status, 0);
  assert.equal(read(dir, 9), "nine\n");
  const ten = read(dir, 10).split("\n");
  assert.equal(ten[0], "ten");
  assert.match(ten[1], LINE);
});

test("an empty note writes nothing", () => {
  const dir = vault();
  assert.equal(run(dir, ["   "]).status, 0);
  assert.equal(fs.existsSync(path.join(dir, "Sessions/Session 1.md")), false);
});

test("a quiet session exits 3 without writing", () => {
  const dir = vault();
  run(dir, ["one"]);
  age(dir, 1, 13);
  const before = read(dir, 1);
  const r = run(dir, ["two"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Session 1 went quiet/);
  assert.equal(read(dir, 1), before);
  assert.equal(run(dir, ["--stdin"], "two").status, 3); // no dialog allowed: same answer
});

test("--here keeps a quiet session, --next starts the next", () => {
  const dir = vault();
  run(dir, ["one"]);
  age(dir, 1, 13);
  assert.equal(run(dir, ["--here", "two"]).status, 0);
  assert.ok(lastLine(read(dir, 1)).endsWith(" two"));
  assert.equal(run(dir, ["--next", "three"]).status, 0);
  assert.ok(lastLine(read(dir, 2)).endsWith(" three"));
});

test("--next with no text just starts the next session", () => {
  const dir = vault();
  run(dir, ["one"]);
  const r = run(dir, ["--next"]);
  assert.equal(r.status, 0);
  assert.ok(read(dir, 2).endsWith("## Notes\n\n"));
});

test("a session under 12 hours old is used without asking", () => {
  const dir = vault();
  run(dir, ["one"]);
  age(dir, 1, 11);
  assert.equal(run(dir, ["two"]).status, 0);
  assert.ok(lastLine(read(dir, 1)).endsWith(" two"));
});

test("not a vault: exit 2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "not a vault "));
  const r = run(dir, ["x"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /isn't a Lorekeeper vault/);
});

const pct = (s) => Buffer.from(s).toString("hex").replace(/../g, "%$&");

test("smart hotkey: --dialog over Obsidian opens Quick note there", () => {
  const dir = vault();
  const r = spawnSync("sh", [SCRIPT, "--vault", dir, "--dialog"], {
    encoding: "utf8",
    env: { ...process.env, LK_FRONT_APP: "Obsidian", LK_OPEN: "echo" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), `obsidian://quickadd?choice=${pct("Quick note")}&vault=${pct(path.basename(dir))}`);
  assert.equal(fs.existsSync(path.join(dir, "Sessions")), false);
});

test("--dialog over another app with no dialog tool: exit 2", () => {
  const dir = vault();
  const r = spawnSync("sh", [SCRIPT, "--vault", dir, "--dialog"], {
    encoding: "utf8",
    env: { ...process.env, LK_FRONT_APP: "Discord", LK_NO_DIALOG: "1" },
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--dialog needs osascript/);
});

test("text with % and quotes is saved as typed", () => {
  const dir = vault();
  run(dir, ['"50% off," said Vex']);
  assert.ok(lastLine(read(dir, 1)).endsWith(' "50% off," said Vex'));
});
