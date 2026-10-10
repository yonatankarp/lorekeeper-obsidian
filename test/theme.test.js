const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build, icons } = require("../scripts/build-theme.js");

const ROOT = path.join(__dirname, "..");
const css = build();

test("both themes get Lorekeeper's tokens, prefixed", () => {
  assert.match(css, /\.theme-light \{[^}]*--lk-bg: #f1e6cc;/);
  assert.match(css, /\.theme-dark \{[^}]*--lk-bg: #1d1b19;/);
  assert.match(css, /--lk-side-fg: var\(--lk-fg\);/);
  assert.doesNotMatch(css, /var\(--(?!lk-)(bg|fg|panel|grain|mottle)\)/);
});

test("fonts are inlined, nothing loads from a path", () => {
  assert.equal((css.match(/data:font\/woff2;base64,/g) || []).length, 9);
  assert.doesNotMatch(css, /url\("fonts\//);
});

test("every kind folder has its icon", () => {
  for (const folder of ["PCs", "NPCs", "Locations", "Items", "Factions", "Quests", "Lore", "Sessions"])
    assert.ok(css.includes(`.nav-folder-title[data-path="${folder}"]`), folder);
  assert.ok(Object.keys(icons(fs.readFileSync(path.join(ROOT, "theme/upstream/icons.js"), "utf8"))).includes("npc"));
});

test("styles every class the session view emits", () => {
  const view = fs.readFileSync(path.join(ROOT, "_lorekeeper/scripts/session.js"), "utf8");
  const classes = new Set([...view.matchAll(/lk-[a-z-]+/g)].map((m) => m[0]).filter((c) => !c.endsWith("-")));
  assert.ok(classes.size >= 10, "found the view's classes");
  const hasClass = (cls) => new RegExp("\\." + cls + "(?![\\w-])").test(css);
  for (const cls of classes) assert.ok(hasClass(cls), cls);
  const template = fs.readFileSync(path.join(ROOT, "_lorekeeper/templates/session.md"), "utf8");
  for (const cls of template.match(/^cssclasses:\n((?:\s+- .+\n)+)/m)[1].matchAll(/- (\S+)/g)) assert.ok(hasClass(cls[1]), cls[1]);
  for (const kind of ["event", "npc", "loot", "quest", "mystery", "quote"]) assert.ok(css.includes(`.lk-kind-${kind}`), kind);
});

test("theme.css is up to date", () => {
  assert.equal(fs.readFileSync(path.join(ROOT, ".obsidian/themes/Lorekeeper/theme.css"), "utf8"), css);
});

test("status marks and attitude colours, Lorekeeper's rules", () => {
  for (const sel of ['[data-link-status="done"]', '[data-link-status="failed"]', '[data-link-condition="dead"]',
    '[data-link-condition="missing"]', '[data-link-attitude="friendly"]', '[data-link-attitude="hostile"]'])
    assert.ok(css.includes(sel), sel);
  assert.match(css, /--lk-icon-done: url\("data:image\/svg\+xml,/);
  assert.match(css, /--lk-icon-failed: url\("data:image\/svg\+xml,/);
});

test("every marked value is one the dropdowns offer", () => {
  const sel = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/custom-selectors/data.json"), "utf8"))
    .selectors.map((s) => [s.name, s.options]));
  for (const m of css.matchAll(/\[data-link-(status|condition|attitude)="([^"]+)"\]/g)) assert.ok(sel[m[1]].includes(m[2]), m[0]);
});
