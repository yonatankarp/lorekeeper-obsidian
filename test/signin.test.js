const { test } = require("node:test");
const assert = require("node:assert/strict");
const s = require("../_lorekeeper/lib/signin.js");
const pcsync = require("../_lorekeeper/lib/pcsync.js");

test("cleanCookie strips the name and spaces", () => {
  assert.equal(s.cleanCookie("  CobaltSession=abc.def  "), "abc.def");
  assert.equal(s.cleanCookie("abc.def"), "abc.def");
  assert.equal(s.cleanCookie('"abc"'), "abc");
  assert.equal(s.cleanCookie("   "), "");
});

test("signIn stores only in secret storage, and refuses without it", () => {
  const store = new Map();
  const secretStorage = { setSecret: (k, v) => store.set(k, v), getSecret: (k) => store.get(k) ?? null };
  s.signIn(secretStorage, "CobaltSession=xyz");
  assert.deepEqual([...store], [["lorekeeper-dndbeyond", "xyz"]]);
  assert.throws(() => s.signIn(undefined, "xyz"), /needs Obsidian's secret storage/);
  assert.throws(() => s.signIn(secretStorage, "  "), /Paste your CobaltSession cookie/);
  s.signOut(secretStorage);
  assert.equal(store.get("lorekeeper-dndbeyond"), "");
});

test("pcsync and signin use the same secret id", () => {
  assert.equal(pcsync.SECRET_ID, s.SECRET_ID);
});
