const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "_lorekeeper/scripts/session.js"), "utf8");

const VAULT = {
  "Sessions/Session 1.md": "- 20:00 shared line\n",
  "Private/Vex/Sessions/Session 1.md": "- 20:01 vex secret\n",
  "Private/Mirela/Sessions/Session 1.md": "- 20:02 mirela secret\n",
};

function makeContainer() {
  const c = {
    children: [],
    querySelectorAll(sel) {
      const cls = sel.slice(1);
      return c.children.filter((o) => o.cls === cls).map((o) => ({ remove() { c.children.splice(c.children.indexOf(o), 1); } }));
    },
  };
  return c;
}

async function run(me, container = makeContainer(), times = 1) {
  const reads = [];
  const out = [];
  const el = (tag, text, opts = {}) => {
    const o = { text, cls: opts.cls, createEl: () => el("x", ""), toggleClass() {}, addEventListener() {}, set hidden(v) {} };
    out.push(o);
    if (!opts.container) container.children.push(o);
    return o;
  };
  const app = {
    loadLocalStorage: () => me,
    metadataCache: { getFirstLinkpathDest: () => null },
    vault: {
      getResourcePath: () => "",
      adapter: {
        async read(p) {
          reads.push(p);
          if (p.startsWith("_lorekeeper/")) return fs.readFileSync(path.join(ROOT, p), "utf8");
          if (p in VAULT) return VAULT[p];
          throw new Error(`no ${p}`);
        },
        async exists(p) { return p in VAULT || Object.keys(VAULT).some((k) => k.startsWith(`${p}/`)); },
        async list(dir) {
          const names = new Set(Object.keys(VAULT).filter((k) => k.startsWith(`${dir}/`)).map((k) => k.slice(dir.length + 1).split("/")[0]));
          const files = [...names].filter((n) => n.includes(".")).map((n) => `${dir}/${n}`);
          const folders = [...names].filter((n) => !n.includes(".")).map((n) => `${dir}/${n}`);
          return { files, folders };
        },
      },
    },
  };
  const dv = {
    container,
    el: (tag, text, opts) => el(tag, text, opts),
    page: () => null,
    pages: () => Object.assign([], { where() { return this; } }),
  };
  const fn = new Function("dv", "input", "app", "localStorage", "(async () => { " + SRC + " })()");
  const runs = [];
  for (let i = 0; i < times; i++) runs.push(fn(dv, { file: "Sessions/Session 1.md" }, app, { getItem: () => null, setItem() {} }));
  await Promise.all(runs);
  await new Promise((r) => setTimeout(r, 20));
  return { reads, text: out.map((o) => String(o.text)).join("\n") };
}

test("a player never reads or sees another player's private notes", async () => {
  const { reads, text } = await run("Vex");
  assert.ok(!reads.some((p) => p.startsWith("Private/Mirela/")), reads.join(", "));
  assert.ok(text.includes("check your sync setup"));
  assert.ok(text.includes("vex secret"));
  assert.ok(!text.includes("mirela secret"));
  assert.ok(!/vex secret[^\n]*lk-author/.test(text));
});

test("the DM sees every private note with names and no warning", async () => {
  const { text } = await run("DM");
  assert.ok(text.includes("vex secret") && text.includes("mirela secret"));
  assert.ok(text.includes("Vex</span>") && text.includes("Mirela</span>"));
  assert.ok(!text.includes("check your sync setup"));
});

test("running the view twice into the same container leaves one view", async () => {
  const container = makeContainer();
  await run("Vex", container, 2);
  assert.equal(container.children.filter((o) => o.cls === "lk-session-view").length, 1);
  await run("Vex", container);
  assert.equal(container.children.filter((o) => o.cls === "lk-session-view").length, 1);
});
