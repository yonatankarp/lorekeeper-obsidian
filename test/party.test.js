const { test } = require("node:test");
const assert = require("node:assert/strict");
const p = require("../_lorekeeper/lib/party.js");

const H = 3600e3;
const NOW = Date.UTC(2026, 9, 10, 20, 0);

test("meFromTsv matches the vault path exactly", () => {
  const tsv = "/a/vault\tVex\n/a/vault 2\tHalia\n/b/My Vault\tDM\n";
  assert.equal(p.meFromTsv(tsv, "/a/vault"), "Vex");
  assert.equal(p.meFromTsv(tsv, "/a/vault 2"), "Halia");
  assert.equal(p.meFromTsv(tsv, "/b/My Vault"), "DM");
  assert.equal(p.meFromTsv(tsv, "/a/vault/sub"), "");
  assert.equal(p.meFromTsv("/a/vault 2\tHalia\n", "/a/vault"), "");
  assert.equal(p.meFromTsv("", "/a/vault"), "");
});

test("tsvWith adds, replaces and removes one vault's line", () => {
  const tsv = "/a\tVex\n/b\tDM\n";
  assert.equal(p.tsvWith("", "/a", "Vex"), "/a\tVex\n");
  assert.equal(p.tsvWith(tsv, "/c", "Halia"), "/a\tVex\n/b\tDM\n/c\tHalia\n");
  assert.equal(p.tsvWith(tsv, "/a", "Halia"), "/a\tHalia\n/b\tDM\n");
  assert.equal(p.tsvWith(tsv, "/a", ""), "/b\tDM\n");
  assert.equal(p.tsvWith("/a\tVex\n", "/a", ""), "");
  assert.equal(p.tsvWith("/a\tVex", "/b", "DM"), "/a\tVex\n/b\tDM\n");
});

test("paths round-trip", () => {
  assert.equal(p.DM, "DM");
  assert.equal(p.partPath(3, "Vex"), "Sessions/Session 3/Vex.md");
  assert.equal(p.privateSessionPath(3, "Vex"), "Private/Vex/Sessions/Session 3.md");
  assert.equal(p.privatePath("NPCs/Halia.md", "Vex"), "Private/Vex/NPCs/Halia.md");
  assert.equal(p.sharedPath("Private/Vex/NPCs/Halia.md"), "NPCs/Halia.md");
  assert.equal(p.sharedPath("NPCs/Halia.md"), "NPCs/Halia.md");
  assert.equal(p.privateOwner("Private/Sibling 5/Sessions/Session 1.md"), "Sibling 5");
  assert.equal(p.privateOwner("NPCs/Halia.md"), "");
  assert.equal(p.sharedPath(p.privatePath("Places/Inn.md", "Vex")), "Places/Inn.md");
  assert.equal(p.privateOwner(p.privatePath("Places/Inn.md", "Vex")), "Vex");
});

test("canPick refuses DM as a PC name", () => {
  assert.equal(p.canPick("DM"), false);
  assert.equal(p.canPick("Vex"), true);
});

test("privateNote", () => {
  assert.deepEqual(p.privateNote("~@Halia lies"), { private: true, text: "@Halia lies" });
  assert.deepEqual(p.privateNote("  ~x"), { private: true, text: "x" });
  assert.deepEqual(p.privateNote("~~struck~~"), { private: false, text: "~~struck~~" });
  assert.deepEqual(p.privateNote("a ~ b"), { private: false, text: "a ~ b" });
});

test("joinOrNext", () => {
  assert.equal(p.joinOrNext({ n: 4, mine: false, others: [NOW - 2 * H], nowMs: NOW }), 4);
  assert.equal(p.joinOrNext({ n: 4, mine: true, others: [NOW - 2 * H], nowMs: NOW }), 5);
  assert.equal(p.joinOrNext({ n: 4, mine: false, others: [NOW - 13 * H], nowMs: NOW }), 5);
  assert.equal(p.joinOrNext({ n: 4, mine: false, others: [], nowMs: NOW }), 5);
  assert.equal(p.joinOrNext({ n: 0, mine: false, others: [], nowMs: NOW }), 1);
  assert.equal(p.joinOrNext({ n: 0, mine: false, others: [NOW], nowMs: NOW }), 1);
});

test("quietParty", () => {
  assert.equal(p.quietParty({ mineMtime: NOW - 13 * H, othersMtimes: [NOW - H], nowMs: NOW }), true);
  assert.equal(p.quietParty({ mineMtime: NOW - H, othersMtimes: [NOW - 20 * H], nowMs: NOW }), false);
  assert.equal(p.quietParty({ mineMtime: null, othersMtimes: [NOW - H], nowMs: NOW }), false);
  assert.equal(p.quietParty({ mineMtime: null, othersMtimes: [NOW - 13 * H, NOW - 14 * H], nowMs: NOW }), true);
  assert.equal(p.quietParty({ mineMtime: null, othersMtimes: [], nowMs: NOW }), true);
});

test("takeLines removes an inclusive range", () => {
  assert.deepEqual(p.takeLines("a\nb\nc\nd\n", 1, 2), { rest: "a\nd\n", lines: ["b", "c"] });
  assert.deepEqual(p.takeLines("a\nb", 0, 0), { rest: "b", lines: ["a"] });
});

test("privatizeLines drops the ~ and links the page", () => {
  assert.deepEqual(p.privatizeLines(["- 20:14 ~@[[Lorelei]] secret"]), ["- 20:14 @[[Lorelei]] secret"]);
  const halia = { name: "Halia", kind: "npc" };
  assert.deepEqual(p.privatizeLines(["~ She had a deal with [[Lorelei]]"], halia), [
    "@[[Halia]] She had a deal with [[Lorelei]]",
  ]);
  assert.deepEqual(p.privatizeLines(["~ Met [[Halia]] again", "~ Met @[[Halia]]", "~ See [[Halia|her]]"], halia), [
    "Met [[Halia]] again",
    "Met @[[Halia]]",
    "See [[Halia|her]]",
  ]);
  assert.deepEqual(p.privatizeLines(["- 20:05 x"], { name: "Page", kind: "place" }), ["- 20:05 [[Page]] x"]);
  assert.deepEqual(p.privatizeLines(["- 20:05 ~x"], { name: "Page", kind: "place" }), ["- 20:05 [[Page]] x"]);
  assert.deepEqual(p.privatizeLines(["~~struck~~ x"]), ["~~struck~~ x"]);
});

test("visiblePrivate", () => {
  const paths = ["Private/Vex/Sessions/Session 1.md", "Private/Sibling 5/Sessions/Session 1.md", "Private/Vex/NPCs/Halia.md", "Sessions/Session 1.md"];
  assert.deepEqual(p.visiblePrivate({ me: "Vex", isDM: false, paths }), {
    show: ["Private/Vex/Sessions/Session 1.md"],
    foreign: ["Private/Sibling 5/Sessions/Session 1.md"],
  });
  assert.deepEqual(p.visiblePrivate({ me: "DM", isDM: true, paths }), {
    show: ["Private/Vex/Sessions/Session 1.md", "Private/Sibling 5/Sessions/Session 1.md"],
    foreign: [],
  });
});

test("privatizeLines keeps a trailing \\r and never throws", () => {
  assert.deepEqual(p.privatizeLines(["- 20:14 ~secret\r"]), ["- 20:14 secret\r"]);
  assert.deepEqual(p.privatizeLines(["~ deal\r"], { name: "Halia", kind: "npc" }), ["@[[Halia]] deal\r"]);
  assert.deepEqual(p.privatizeLines(["plain\r", "", "\r"]), ["plain\r", "", "\r"]);
  assert.deepEqual(p.privatizeLines(["a b", "\u0085"]), ["a b", "\u0085"]);
});

test("a lone ~ stays as it is", () => {
  const page = { name: "Halia", kind: "npc" };
  assert.deepEqual(p.privatizeLines(["~", "- 20:14 ~  ", "  ~ \r"], page), ["~", "- 20:14 ~  ", "  ~ \r"]);
});

test("privatizeLines keeps indentation", () => {
  assert.deepEqual(p.privatizeLines(["  - 20:14 ~x"]), ["  - 20:14 x"]);
});

test("a line that already links the page gets no second link", () => {
  const page = { name: "Halia", kind: "npc" };
  for (const body of ["[[halia]]", "[[NPCs/Halia]]", "[[Halia\\|her]]", "[[Halia#Notes]]", "[[Halia|her]]", "@[[HALIA]]"]) {
    assert.deepEqual(p.privatizeLines([`~ met ${body}`], page), [`met ${body}`], body);
  }
  assert.deepEqual(p.privatizeLines(["~ met [[Halia Two]]"], page), ["@[[Halia]] met [[Halia Two]]"]);
});

test("exactly 12 hours counts as fresh", () => {
  assert.equal(p.joinOrNext({ n: 4, mine: false, others: [NOW - 12 * H], nowMs: NOW }), 4);
  assert.equal(p.joinOrNext({ n: 4, mine: false, others: [NOW - 12 * H - 1], nowMs: NOW }), 5);
  assert.equal(p.quietParty({ mineMtime: NOW - 12 * H, othersMtimes: [], nowMs: NOW }), false);
  assert.equal(p.quietParty({ mineMtime: NOW - 12 * H - 1, othersMtimes: [], nowMs: NOW }), true);
});

test("visiblePrivate without a name shows nothing", () => {
  const paths = ["Private/Vex/Sessions/Session 1.md", "Private/Halia/Sessions/Session 2.md"];
  assert.deepEqual(p.visiblePrivate({ me: "", isDM: false, paths }), { show: [], foreign: paths });
});

test("meFromTsv with CRLF and trailing slashes", () => {
  assert.equal(p.meFromTsv("/a/vault\tVex\r\n/b\tDM\r\n", "/a/vault"), "Vex");
  assert.equal(p.meFromTsv("/b\tDM\r\n", "/b"), "DM");
  assert.equal(p.meFromTsv("/a/vault\tVex\n", "/a/vault/"), "");
  assert.equal(p.meFromTsv("/a/vault/\tVex\n", "/a/vault"), "");
  assert.equal(p.meFromTsv("/a/vault/\tVex\n", "/a/vault/"), "Vex");
});

test("sessionOf reads N from a session page or a per-author file, else 0", () => {
  assert.equal(p.sessionOf("Sessions/Session 4.md"), 4);
  assert.equal(p.sessionOf("Sessions/Session 12/Vex.md"), 12);
  for (const other of ["NPCs/Session 4.md", "Sessions/Session 4/a/b.md", "Private/Vex/Sessions/Session 4.md", "Sessions/Notes.md"]) assert.equal(p.sessionOf(other), 0, other);
});

test("isEmptyNoteLine: blank, lone ~, and bare bullets are empty; text is not", () => {
  for (const l of ["", "   ", "~", "- ~", "- 20:05 ~", "- 20:05 "]) assert.equal(p.isEmptyNoteLine(l), true, JSON.stringify(l));
  for (const l of ["a", "~ a", "- 20:05 ~ a", "~~", "- 20:05 x"]) assert.equal(p.isEmptyNoteLine(l), false, JSON.stringify(l));
});
