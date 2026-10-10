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

// Party mode: identity comes from me.tsv in a temp HOME (or --me).
function partyVault() {
  const dir = vault();
  fs.copyFileSync(path.join(ROOT, "_lorekeeper/templates/session-part.md"), path.join(dir, "_lorekeeper/templates/session-part.md"));
  return dir;
}
function runAs(dir, name, args, input, tsv) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "lk home "));
  const env = { ...process.env, HOME: home, LK_NO_DIALOG: "1" };
  delete env.XDG_CONFIG_HOME;
  const lines = tsv ?? (name == null ? "" : `${dir}\t${name}\n`);
  if (lines) {
    fs.mkdirSync(path.join(home, ".config/lorekeeper"), { recursive: true });
    fs.writeFileSync(path.join(home, ".config/lorekeeper/me.tsv"), lines);
  }
  return spawnSync("sh", [SCRIPT, "--vault", dir, ...args], { encoding: "utf8", input, env });
}
const rel = (dir, p) => fs.readFileSync(path.join(dir, p), "utf8");
const agePath = (dir, p, hours) => {
  const t = Date.now() / 1000 - hours * 3600;
  fs.utimesSync(path.join(dir, p), t, t);
};

test("party: a note goes to your own part file, with the view page created", () => {
  const dir = partyVault();
  const r = runAs(dir, "Vex Ahlo", ["hello", "there"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Sessions/Session 1/Vex Ahlo.md"));
  const part = rel(dir, "Sessions/Session 1/Vex Ahlo.md");
  assert.match(part, /^---\nsession: 1\ndate: \d{4}-\d{2}-\d{2}\nauthor: "\[\[Vex Ahlo\]\]"\n---\n## Notes\n\n- \d{2}:\d{2} hello there\n$/);
  assert.match(read(dir, 1), /^---\nsession: 1\n/);
  assert.equal(read(dir, 1).includes("hello there"), false);
});

test("party: a ~ note is private and never reaches the part file or the view", () => {
  const dir = partyVault();
  assert.equal(runAs(dir, "Vex", ["open"]).status, 0);
  const r = runAs(dir, "Vex", ["  ~", " the", "secret"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Private/Vex/Sessions/Session 1.md"));
  const priv = rel(dir, "Private/Vex/Sessions/Session 1.md");
  assert.match(priv, /^---\nsession: 1\n[^]*author: "\[\[Vex\]\]"\n---\n## Notes\n\n- \d{2}:\d{2} the secret\n$/);
  assert.equal(rel(dir, "Sessions/Session 1/Vex.md").includes("secret"), false);
  assert.equal(read(dir, 1).includes("secret"), false);
});

test("party: a first ~ note creates the view but no shared part file", () => {
  const dir = partyVault();
  assert.equal(runAs(dir, "Vex", ["~ hush"]).status, 0);
  assert.equal(fs.existsSync(path.join(dir, "Sessions/Session 1.md")), true);
  assert.equal(fs.existsSync(path.join(dir, "Sessions/Session 1/Vex.md")), false);
  assert.equal(read(dir, 1).includes("hush"), false);
});

test("party: ~~ is strikethrough (shared) and a lone ~ is not a note", () => {
  const dir = partyVault();
  assert.equal(runAs(dir, "Vex", ["~~wrong~~"]).status, 0);
  assert.ok(lastLine(rel(dir, "Sessions/Session 1/Vex.md")).endsWith(" ~~wrong~~"));
  assert.equal(fs.existsSync(path.join(dir, "Private")), false);
  assert.equal(runAs(dir, "Vex", ["~"]).status, 0);
  assert.equal(fs.existsSync(path.join(dir, "Private")), false);
  assert.equal(rel(dir, "Sessions/Session 1/Vex.md").split("\n").filter((l) => LINE.test(l)).length, 1);
});

test("party: the me.tsv path must match the vault exactly", () => {
  const dir = partyVault();
  const real = dir;
  const r = runAs(dir, null, ["solo note"], undefined, `${real} 2\tVex\n`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Sessions/Session 1.md"));
  assert.ok(lastLine(read(dir, 1)).endsWith(" solo note"));
  const r2 = runAs(dir, null, ["other"], undefined, `${real} 2\tVex\n${real}\tIvo\n`);
  assert.equal(r2.stdout.trim(), path.join(dir, "Sessions/Session 1/Ivo.md"));
});

test("party: --me DM writes DM.md with author: DM, and --me \"\" forces solo", () => {
  const dir = partyVault();
  const r = runAs(dir, "Vex", ["--me", "DM", "dm note"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Sessions/Session 1/DM.md"));
  assert.match(rel(dir, "Sessions/Session 1/DM.md"), /\nauthor: DM\n/);
  const solo = runAs(dir, "Vex", ["--me", "", "plain"]);
  assert.equal(solo.stdout.trim(), path.join(dir, "Sessions/Session 1.md"));
  assert.ok(lastLine(read(dir, 1)).endsWith(" plain"));
});

test("party: quiet is judged by your own file's age", () => {
  const dir = partyVault();
  runAs(dir, "Vex", ["one"]);
  runAs(dir, "Ivo", ["fresh teammate"]);
  agePath(dir, "Sessions/Session 1/Vex.md", 13);
  const r = runAs(dir, "Vex", ["two"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Session 1 went quiet/);
  assert.equal(runAs(dir, "Vex", ["--here", "two"]).status, 0);
  // never wrote here and nothing fresh anywhere: quiet; a fresh teammate: not quiet
  const dir2 = partyVault();
  runAs(dir2, "Ivo", ["x"]);
  assert.equal(runAs(dir2, "Vex", ["hi"]).status, 0);
  agePath(dir2, "Sessions/Session 1/Ivo.md", 13);
  agePath(dir2, "Sessions/Session 1/Vex.md", 13);
  agePath(dir2, "Sessions/Session 1.md", 13);
  fs.rmSync(path.join(dir2, "Sessions/Session 1/Vex.md"));
  assert.equal(runAs(dir2, "Vex", ["hi"]).status, 3);
});

test("party: --next joins a teammate's fresh session, else starts the next", () => {
  const dir = partyVault();
  runAs(dir, "Ivo", ["we begin"]);
  const r = runAs(dir, "Vex", ["--next", "me too"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Sessions/Session 1/Vex.md"));
  const again = runAs(dir, "Vex", ["--next", "new one"]); // you already wrote in 1
  assert.equal(again.stdout.trim(), path.join(dir, "Sessions/Session 2/Vex.md"));
  const dir2 = partyVault();
  runAs(dir2, "Ivo", ["old"]);
  agePath(dir2, "Sessions/Session 1/Ivo.md", 13);
  agePath(dir2, "Sessions/Session 1.md", 13);
  assert.equal(runAs(dir2, "Vex", ["--next"]).status, 0);
  assert.equal(fs.existsSync(path.join(dir2, "Sessions/Session 2/Vex.md")), true);
});

test("party: an author name with sed characters is kept as typed", () => {
  const dir = partyVault();
  assert.equal(runAs(dir, "Tom & Jerry | Co", ["hi"]).status, 0);
  assert.match(rel(dir, "Sessions/Session 1/Tom & Jerry | Co.md"), /\nauthor: "\[\[Tom & Jerry \| Co\]\]"\n/);
});

// Fail closed: with no identity, a ~ note in a vault that shows party play would land in the shared session page.
const REFUSE = "lk-note: pick your character in Obsidian first (this note starts with ~, so it would be shared)\n";
const anyFileHas = (dir, word) => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).some((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : fs.readFileSync(p, "utf8").includes(word);
  });
  return ["Sessions", "Private"].some((s) => fs.existsSync(path.join(dir, s)) && walk(path.join(dir, s)));
};

for (const sign of ["Private", "Sessions/Session 1"]) {
  test(`party signs (${sign}/): a ~ note with no identity is refused and writes nothing`, () => {
    const dir = partyVault();
    fs.mkdirSync(path.join(dir, sign), { recursive: true });
    const r = runAs(dir, null, ["~", "secret"], undefined, `${dir}-elsewhere\tVex\n`);
    assert.equal(r.status, 4);
    assert.equal(r.stderr, REFUSE);
    assert.equal(r.stdout, "");
    assert.equal(anyFileHas(dir, "secret"), false);
  });
}

test("party signs: --me \"\" with a ~ note is refused too", () => {
  const dir = partyVault();
  fs.mkdirSync(path.join(dir, "Private"));
  const r = runAs(dir, "Vex", ["--me", "", "~ secret"]);
  assert.equal(r.status, 4);
  assert.equal(r.stderr, REFUSE);
  assert.equal(anyFileHas(dir, "secret"), false);
});

test("party signs: with no identity a normal note still saves solo", () => {
  const dir = partyVault();
  fs.mkdirSync(path.join(dir, "Sessions/Session 1"), { recursive: true });
  const r = runAs(dir, null, ["plain", "note"], undefined, `${dir}-elsewhere\tVex\n`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Sessions/Session 1.md"));
  assert.ok(lastLine(read(dir, 1)).endsWith(" plain note"));
  for (const t of ["~~struck~~", "~"]) assert.equal(runAs(dir, null, [t], undefined, "").status, 0, t);
});

test("solo vault (no party signs): a ~ note is kept as typed in Session N.md", () => {
  const dir = partyVault();
  const r = runAs(dir, null, ["~ x"], undefined, "");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(lastLine(read(dir, 1)).endsWith(" ~ x"));
});

test("party: me.tsv can name the vault as it was passed (a relative --vault)", () => {
  const dir = partyVault();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "lk home "));
  fs.mkdirSync(path.join(home, ".config/lorekeeper"), { recursive: true });
  fs.writeFileSync(path.join(home, ".config/lorekeeper/me.tsv"), `${path.basename(dir)}\tVex\n`);
  const env = { ...process.env, HOME: home, LK_NO_DIALOG: "1" };
  delete env.XDG_CONFIG_HOME;
  const r = spawnSync("sh", [SCRIPT, "--vault", path.basename(dir), "hi"], { encoding: "utf8", env, cwd: path.dirname(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(path.join(dir, "Sessions/Session 1/Vex.md")), true);
});

test("party: --next with a ~ note goes to the private file of the joined or next session", () => {
  const dir = partyVault();
  runAs(dir, "Ivo", ["we begin"]);
  const r = runAs(dir, "Vex", ["--next", "~ joined secret"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.join(dir, "Private/Vex/Sessions/Session 1.md"));
  assert.equal(fs.existsSync(path.join(dir, "Sessions/Session 1/Vex.md")), false);
  runAs(dir, "Vex", ["shared"]);
  const next = runAs(dir, "Vex", ["--next", "~ next secret"]);
  assert.equal(next.stdout.trim(), path.join(dir, "Private/Vex/Sessions/Session 2.md"));
  assert.ok(lastLine(rel(dir, "Private/Vex/Sessions/Session 2.md")).endsWith(" next secret"));
  assert.equal(fs.existsSync(path.join(dir, "Sessions/Session 2/Vex.md")), false);
  for (const f of ["Sessions/Session 1.md", "Sessions/Session 1/Ivo.md", "Sessions/Session 1/Vex.md", "Sessions/Session 2.md"])
    assert.equal(rel(dir, f).includes("secret"), false, f);
});
