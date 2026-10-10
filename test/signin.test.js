const { test } = require("node:test");
const assert = require("node:assert/strict");
const s = require("../_lorekeeper/lib/signin.js");
const pcsync = require("../_lorekeeper/lib/pcsync.js");
const d = require("../_lorekeeper/lib/dndbeyond.js");

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

test("afterVerify signs out an expired cookie and keeps the previous one on any other error", () => {
  const expired = new Error(d.MESSAGES.expired);
  assert.equal(s.afterVerify(null, "old", d.MESSAGES.expired), null);
  assert.deepEqual(s.afterVerify(expired, "old", d.MESSAGES.expired), { keep: "", message: d.MESSAGES.expired });
  assert.deepEqual(s.afterVerify(new Error(d.MESSAGES.unreachable), "old", d.MESSAGES.expired), {
    keep: "old", message: "Couldn't check the sign-in: Couldn't reach D&D Beyond. Check your internet connection. Your previous sign-in is kept.",
  });
  assert.deepEqual(s.afterVerify(new Error("D&D Beyond's sign-in service said: 503"), null, d.MESSAGES.expired), {
    keep: "", message: "Couldn't check the sign-in: D&D Beyond's sign-in service said: 503. Your previous sign-in is kept.",
  });
});

test("the sign-in help points at the doc in this vault", () => {
  assert.throws(() => s.signIn({ setSecret() {} }, " "), /see docs\/DNDBEYOND\.md in this vault/);
});
