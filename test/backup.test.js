const { test } = require("node:test");
const assert = require("node:assert/strict");
const b = require("../_lorekeeper/lib/backup.js");

const config = (url) => `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n`;

test("originUrl reads the origin remote only", () => {
  assert.equal(b.originUrl(config("git@github.com:me/strahd.git")), "git@github.com:me/strahd.git");
  assert.equal(b.originUrl('[remote "upstream"]\n\turl = x\n'), "");
  assert.equal(b.originUrl(""), "");
});

test("isTemplateRepo knows the template in every spelling", () => {
  for (const u of ["https://github.com/yonatankarp/lorekeeper-obsidian", "https://github.com/yonatankarp/lorekeeper-obsidian.git",
    "git@github.com:yonatankarp/lorekeeper-obsidian.git", "ssh://git@github.com/yonatankarp/lorekeeper-obsidian"])
    assert.equal(b.isTemplateRepo(u), true, u);
  for (const u of ["git@github.com:me/strahd.git", "https://github.com/yonatankarp/lorekeeper"]) assert.equal(b.isTemplateRepo(u), false, u);
});

test("backupStatus messages", () => {
  assert.deepEqual(b.backupStatus(null, false), { level: "warn", message: "No backup yet: this vault isn't a git repository. See docs/BACKUP.md." });
  assert.deepEqual(b.backupStatus(config("https://github.com/yonatankarp/lorekeeper-obsidian.git"), false),
    { level: "warn", message: "This vault still points at the public Lorekeeper template. Point it at your own private repository before turning on Obsidian Git (docs/BACKUP.md, step 2)." });
  assert.deepEqual(b.backupStatus("[core]\n", false), { level: "warn", message: "This vault has no origin repository to back up to. See docs/BACKUP.md, step 2." });
  assert.deepEqual(b.backupStatus(config("git@github.com:me/strahd.git"), false),
    { level: "warn", message: "Ready to back up to git@github.com:me/strahd.git: turn on Obsidian Git in Settings > Community plugins." });
  assert.deepEqual(b.backupStatus(config("git@github.com:me/strahd.git"), true), { level: "ok", message: "Backing up to git@github.com:me/strahd.git." });
});
