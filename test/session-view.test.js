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

async function run(me) {
  const reads = [];
  const out = [];
  const el = (tag, text) => {
    const o = { text, createEl: () => el("x", ""), toggleClass() {}, addEventListener() {}, set hidden(v) {} };
    out.push(o);
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
    el: (tag, text) => el(tag, text),
    page: () => null,
    pages: () => Object.assign([], { where() { return this; } }),
  };
  const fn = new Function("dv", "input", "app", "localStorage", "(async () => { " + SRC + " })()");
  const done = fn(dv, { file: "Sessions/Session 1.md" }, app, { getItem: () => null, setItem() {} });
  await done;
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
