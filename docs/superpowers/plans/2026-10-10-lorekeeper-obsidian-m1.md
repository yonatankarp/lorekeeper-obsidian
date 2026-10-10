# Lorekeeper for Obsidian, M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clonable Obsidian vault that gives one player Lorekeeper's M1 workflow and look: quick notes from anywhere, sessions with a Timeline and Journal, typed pages with status dropdowns, Home, and the Tome and Dungeon themes.

**Architecture:** The repo root is the vault. All logic lives in small CommonJS modules under `_lorekeeper/lib/`, unit-tested with `node --test`, and loaded inside Obsidian by `_lorekeeper/lib/load.js`. Thin entry scripts call them from QuickAdd (commands), DataviewJS (the session view) and Templater (the new-note kind picker). Capture from outside Obsidian is one POSIX shell script, `_lorekeeper/capture/lk-note`. The theme is generated from a verbatim copy of Lorekeeper's styles, icons and fonts.

**Tech Stack:** Obsidian 1.10+ with core Bases. Community plugins: QuickAdd 2.32.1, Templater 2.25.1, Dataview 0.5.70, Custom Selectors 1.1.0. Node 20+ for tests and the theme build (no npm dependencies). POSIX `sh`, `shellcheck`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-10-lorekeeper-obsidian-design.md`

## Global Constraints

- The repo is `~/Projects/_private_projects/lorekeeper-obsidian`, branch `main`, and its root is the vault. One vault is one campaign.
- Lorekeeper's source, for copying, is `~/Projects/_private_projects/lorekeeper` at commit `32a07f6`.
- Behaviour matches Lorekeeper's `docs/GUIDE.md`. Files don't have to match Lorekeeper's.
- Kinds: `@` npc, `#` loot, `!` quest, `?` mystery, `"` or `“` quote, else event. Sections in order: What happened, NPCs, Loot, Quests, Mysteries, Quotes.
- A note line is `- HH:MM text` (24-hour local time), with the text's whitespace collapsed to single spaces. An empty note writes nothing.
- A session is `Sessions/Session N.md`. The current session is the highest N among `Session N.md` files and `Session N/` folders. It is quiet when its file hasn't changed in 12 hours (720 minutes).
- Quest `status`: `open`, `in progress`, `done`, `failed`. NPC `condition`: `alive`, `dead`, `missing`, `unknown`. NPC `attitude`: `friendly`, `neutral`, `hostile`, `unknown`.
- A page name can't be empty, use `/ \ : * ? " < > |`, start or end with a dot, or match an existing page's name (ignoring case).
- No npm dependencies. Plugin builds are committed under `.obsidian/plugins/`.
- Desktop and mobile both load `lib/` via `load.js` (no Node `require` inside Obsidian). `lk-note` is desktop only.
- UI copy follows Lorekeeper's style: plain words, **bold** labels in docs, both `⌘` and `Ctrl` shortcuts, no em dashes.
- Commit messages: `kind(Area): what changed`, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **The session file's own view block and headings.** The `dataviewjs` fence and `## Notes` in every session must never show up as notes (Task 2 test: `skips fenced code and headings`).
2. **An abandoned quick note.** Quick note leaves `- 20:05 ` when you close it without typing, and that must not show as an empty note or the text "20:05" (Task 2 test: `a bullet with only a time is not a note`).
3. **A game past midnight.** `23:50` then `00:10` in one file must keep file order in the Timeline, not jump to the top (Task 2 test: `keeps order across midnight`).
4. **Messy input to capture:** a pasted multi-line selection, leading and trailing spaces, a file the user edited so it no longer ends in a newline, and a vault path with spaces (iCloud vaults). Each saves exactly one clean line (Task 3 tests `collapses whitespace` and `appends after a missing newline`; Task 4 tests `vault path with spaces` and `multi-line stdin`).
5. **Session numbering:** `Session 10` must beat `Session 9`, and a folder-only session or files like `Session notes.md` must not break the numbering (Task 3 test `latestSession numbers, not names`; Task 4 test `numeric order`).

---

### Task 1: Repo scaffold, licences and CI

**Files:**
- Create: `package.json`, `.gitignore`, `LICENSE`, `CREDITS.md`, `README.md`, `.github/workflows/test.yml`
- Create: `Sessions/.gitkeep`, `PCs/.gitkeep`, `NPCs/.gitkeep`, `Locations/.gitkeep`, `Items/.gitkeep`, `Factions/.gitkeep`, `Quests/.gitkeep`, `Lore/.gitkeep`, `Attachments/.gitkeep`, `_lorekeeper/scripts/templater/.gitkeep`
- Create: `test/smoke.test.js`

**Interfaces:**
- Produces: `npm test` runs `node --test test/`. Later tasks add `test/*.test.js` files. `npm run build:theme` is defined here and implemented in Task 9.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "lorekeeper-obsidian",
  "private": true,
  "description": "Lorekeeper's D&D session notes as an Obsidian vault",
  "license": "MIT",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test test/",
    "build:theme": "node scripts/build-theme.js",
    "check:theme": "node scripts/build-theme.js --check"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
.DS_Store
node_modules/
.trash/
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
```

- [ ] **Step 3: Write `LICENSE`** (MIT)

```
MIT License

Copyright (c) 2026 Yonatan Karp-Rudin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Write `CREDITS.md`**

```markdown
# Credits

**Fonts:** Solbera's D&D 5e fonts (Bookinsanity, Mr Eaves Small Caps, Scaly Sans, Solbera Imitation), Remake versions by Ners, collected in https://github.com/jonathonf/solbera-dnd-fonts. CC BY-SA 4.0, full text in `theme/upstream/fonts/LICENSE-Solbera.txt`. They're inlined in `.obsidian/themes/Lorekeeper/theme.css`, which is therefore CC BY-SA 4.0 as well.

**Design:** colours, icons and fonts come from [Lorekeeper](https://github.com/yonatankarp/lorekeeper).

**Plugins** (committed under `.obsidian/plugins/`, each under its own licence, all MIT):
- QuickAdd by Christian B. B. Houmann, https://github.com/chhoumann/quickadd
- Templater by SilentVoid13, https://github.com/SilentVoid13/Templater
- Dataview by Michael Brenan, https://github.com/blacksmithgu/obsidian-dataview
- Custom Selectors by hodie, https://github.com/hodie/obsidian-custom-selectors
```

- [ ] **Step 5: Write a stub `README.md`** (Task 11 completes it)

```markdown
# Lorekeeper for Obsidian

Lorekeeper's D&D session notes as an Obsidian vault: one vault per campaign. Work in progress, see `docs/superpowers/specs/`.
```

- [ ] **Step 6: Create the empty campaign folders**

```bash
cd ~/Projects/_private_projects/lorekeeper-obsidian
for d in Sessions PCs NPCs Locations Items Factions Quests Lore Attachments _lorekeeper/scripts/templater; do mkdir -p "$d" && : > "$d/.gitkeep"; done
```

- [ ] **Step 7: Write a smoke test, `test/smoke.test.js`**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("every campaign folder exists", () => {
  for (const d of ["Sessions", "PCs", "NPCs", "Locations", "Items", "Factions", "Quests", "Lore", "Attachments"])
    assert.ok(fs.statSync(path.join(root, d)).isDirectory(), d);
});
```

- [ ] **Step 8: Run it**

Run: `npm test`
Expected: `# pass 1`, `# fail 0`

- [ ] **Step 9: Write `.github/workflows/test.yml`**

```yaml
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test
      - run: shellcheck _lorekeeper/capture/lk-note scripts/update-plugins.sh
        if: hashFiles('_lorekeeper/capture/lk-note') != ''
      - run: npm run check:theme
        if: hashFiles('scripts/build-theme.js') != ''
```

- [ ] **Step 10: Commit**

```bash
git add package.json .gitignore LICENSE CREDITS.md README.md .github test/smoke.test.js Sessions PCs NPCs Locations Items Factions Quests Lore Attachments _lorekeeper/scripts/templater
git commit -m "chore: scaffold the vault, licences and CI

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Notes: parsing, Journal groups and the merged Timeline

**Files:**
- Create: `_lorekeeper/lib/notes.js`
- Test: `test/notes.test.js`

**Interfaces:**
- Produces (`module.exports`):
  - `SECTIONS: Array<[kind: string, label: string]>`, in the Global Constraints order
  - `PREFIX: Record<string, kind>`
  - `notesOf(md: string): Array<{ time: string, kind: string, text: string }>`. `time` is `"HH:MM"` as written, or `""`.
  - `journal(notes): Record<kind, string[]>`, with every section key present
  - `merge(parts: Array<{ author: string, text: string }>): Array<{ time, kind, text, author }>`, in time order

- [ ] **Step 1: Write the failing tests, `test/notes.test.js`**

````js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SECTIONS, notesOf, journal, merge } = require("../_lorekeeper/lib/notes.js");

const SESSION = `---
session: 4
date: 2026-10-10
cssclasses:
  - lk-session
---
\`\`\`dataviewjs
await dv.view("_lorekeeper/scripts/session", { file: dv.current().file.path })
\`\`\`

## Notes

- 20:05 We reach Phandalin
- 20:07 @[[Mirela]] shifty innkeeper
- 20:09 #50 gp and a silver ring
- 20:11 !Find the missing miners
- 20:12 ?Who sent the letter
- 20:15 "Never trust a dwarf with a map"
- 20:16 “Curly quotes count too”
- 20:20 ![[map.png]]
`;

test("files each note by its first character", () => {
  assert.deepEqual(notesOf(SESSION).map((n) => [n.time, n.kind, n.text]), [
    ["20:05", "event", "We reach Phandalin"],
    ["20:07", "npc", "[[Mirela]] shifty innkeeper"],
    ["20:09", "loot", "50 gp and a silver ring"],
    ["20:11", "quest", "Find the missing miners"],
    ["20:12", "mystery", "Who sent the letter"],
    ["20:15", "quote", '"Never trust a dwarf with a map"'],
    ["20:16", "quote", "“Curly quotes count too”"],
    ["20:20", "event", "![[map.png]]"],
  ]);
});

test("skips fenced code and headings", () => {
  const texts = notesOf(SESSION).map((n) => n.text);
  assert.ok(!texts.some((t) => t.includes("dv.view") || t.includes("Notes")));
});

test("a bullet with only a time is not a note", () => {
  assert.deepEqual(notesOf("- 20:05 \n- 20:06\n- 21:00 Real one\n"), [{ time: "21:00", kind: "event", text: "Real one" }]);
});

test("hand-written lines and untimed bullets count", () => {
  assert.deepEqual(notesOf("The party rests.\n* @Vex returns\n---\n"), [
    { time: "", kind: "event", text: "The party rests." },
    { time: "", kind: "npc", text: "Vex returns" },
  ]);
});

test("a time glued to text is just text", () => {
  assert.deepEqual(notesOf("- 20:05pm dinner\n"), [{ time: "", kind: "event", text: "20:05pm dinner" }]);
});

test("a #tag line that isn't a heading is loot", () => {
  assert.deepEqual(notesOf("#sword of the north\n# Heading\n### Sub\n"), [{ time: "", kind: "loot", text: "sword of the north" }]);
});

test("journal groups by kind, every section present", () => {
  const groups = journal(notesOf(SESSION));
  assert.deepEqual(Object.keys(groups), SECTIONS.map(([k]) => k));
  assert.deepEqual(groups.npc, ["[[Mirela]] shifty innkeeper"]);
  assert.equal(groups.event.length, 2);
});

test("merge orders notes from several files by time, with authors", () => {
  const merged = merge([
    { author: "", text: "- 20:00 Start\n- 20:10 Fight\n" },
    { author: "Sibling 5", text: "- 20:05 @Vex winks\n" },
  ]);
  assert.deepEqual(merged.map((n) => [n.time, n.author, n.text]), [
    ["20:00", "", "Start"],
    ["20:05", "Sibling 5", "Vex winks"],
    ["20:10", "", "Fight"],
  ]);
});

test("keeps order across midnight", () => {
  const merged = merge([{ author: "", text: "- 23:50 Late\n- 00:10 Later\n- 9:05 Next morning\n" }]);
  assert.deepEqual(merged.map((n) => n.text), ["Late", "Later", "Next morning"]);
});

test("untimed notes stay after the note before them", () => {
  const merged = merge([
    { author: "", text: "- 20:00 A\nB without time\n- 20:30 C\n" },
    { author: "X", text: "- 20:10 D\n" },
  ]);
  assert.deepEqual(merged.map((n) => n.text), ["A", "B without time", "D", "C"]);
});
````

- [ ] **Step 2: Run them and check they fail**

Run: `node --test test/notes.test.js`
Expected: FAIL with `Cannot find module '../_lorekeeper/lib/notes.js'`

- [ ] **Step 3: Write `_lorekeeper/lib/notes.js`**

```js
// Session notes: lines like "- 21:43 @Mirela the innkeeper", filed by their first character (Lorekeeper's notes.js).
// Hand-written lines count too, so nothing typed under ## Notes is dropped. Loaded in Obsidian by load.js.

const SECTIONS = [
  ["event", "What happened"],
  ["npc", "NPCs"],
  ["loot", "Loot"],
  ["quest", "Quests"],
  ["mystery", "Mysteries"],
  ["quote", "Quotes"],
];

const PREFIX = { "@": "npc", "#": "loot", "!": "quest", "?": "mystery", '"': "quote", "“": "quote" };

const BULLET = /^[-*+](?: (\d{1,2}:\d{2}))?(?: (.*))?$/;

function body(md) {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? md.slice(m[0].length) : md;
}

function notesOf(md) {
  const out = [];
  let code = false;
  for (const raw of body(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      code = !code;
      continue;
    }
    if (code || /^#{1,6} /.test(line) || /^(-{3,}|\*{3,})$/.test(line)) continue;
    const bullet = line.match(BULLET);
    let text = (bullet ? bullet[2] ?? "" : line).trim();
    if (!text) continue;
    const kind = text.startsWith("![") ? "event" : PREFIX[text[0]] ?? "event"; // ![[map.png]] isn't a "!" quest
    if (kind !== "event" && kind !== "quote") text = text.slice(1).trim(); // quotes keep their marks
    if (text) out.push({ time: bullet?.[1] ?? "", kind, text });
  }
  return out;
}

function journal(notes) {
  const groups = Object.fromEntries(SECTIONS.map(([kind]) => [kind, []]));
  for (const n of notes) groups[n.kind].push(n.text);
  return groups;
}

const minutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// Every part's notes in time order. Within a file, a time earlier than the one before means the game went past
// midnight, and an untimed note sorts with the note before it, so a file's own order never changes.
function merge(parts) {
  const all = [];
  parts.forEach(({ author, text }, p) => {
    let day = 0;
    let last = -1;
    notesOf(text).forEach((n, i) => {
      if (n.time) {
        const t = minutes(n.time);
        if (last >= 0 && t + day * 1440 < last) day += 1;
        last = t + day * 1440;
      }
      all.push({ ...n, author, key: Math.max(last, 0), p, i });
    });
  });
  all.sort((a, b) => a.key - b.key || a.p - b.p || a.i - b.i);
  return all.map(({ time, kind, text, author }) => ({ time, kind, text, author }));
}

module.exports = { SECTIONS, PREFIX, notesOf, journal, merge };
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test test/notes.test.js`
Expected: `# pass 10`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add _lorekeeper/lib/notes.js test/notes.test.js
git commit -m "feat(Sessions): notes are filed by kind and merged into one timeline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Sessions: finding, starting and appending

**Files:**
- Create: `_lorekeeper/lib/session.js`, `_lorekeeper/templates/session.md`
- Create: `test/helpers/io.js`
- Test: `test/session.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (`module.exports`):
  - `TEMPLATE = "_lorekeeper/templates/session.md"`
  - `sessionPath(n: number): string` returns `"Sessions/Session N.md"`
  - `latestSession(names: string[]): number`, where `names` are entries of `Sessions/` (files and folders), and 0 means none
  - `isQuiet(mtimeMs: number, nowMs: number): boolean`
  - `isoDate(d: Date): string` (local `YYYY-MM-DD`), `clock(d: Date): string` (local `HH:MM`)
  - `noteLine(text: string, now: Date): string | null`
  - `appendLine(content: string, line: string): string`
  - `renderSession(template: string, n: number, date: string): string`
  - The `io` interface (implemented by `test/helpers/io.js` here and by `load.js` in Task 5): `{ list(dir): Promise<string[]>, exists(path): Promise<boolean>, read(path): Promise<string>, write(path, text): Promise<void>, mtimeMs(path): Promise<number> }`. Paths are vault-relative, and `list` of a missing folder is `[]`.
  - `currentSession(io, nowMs): Promise<{ n: number, path: string | null, quiet: boolean }>`
  - `startSession(io, n, now: Date): Promise<string>`, which writes the file only if it doesn't exist and returns the path
  - `addNote(io, path, text, now: Date): Promise<string | null>`, which returns the line written

- [ ] **Step 1: Write the session template, `_lorekeeper/templates/session.md`**

~~~markdown
---
session: {{session}}
date: {{date}}
cssclasses:
  - lk-session
---
```dataviewjs
await dv.view("_lorekeeper/scripts/session", { file: dv.current().file.path })
```

## Notes

~~~

(The file ends with `## Notes`, a blank line, and a final newline.)

- [ ] **Step 2: Write the test helper, `test/helpers/io.js`**

```js
// session.js's io interface on a real folder, for tests.
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = (root) => ({
  list: async (dir) => fs.readdir(path.join(root, dir)).catch(() => []),
  exists: async (p) => fs.access(path.join(root, p)).then(() => true, () => false),
  read: (p) => fs.readFile(path.join(root, p), "utf8"),
  write: async (p, text) => {
    await fs.mkdir(path.dirname(path.join(root, p)), { recursive: true });
    await fs.writeFile(path.join(root, p), text);
  },
  mtimeMs: async (p) => (await fs.stat(path.join(root, p))).mtimeMs,
});
```

- [ ] **Step 3: Write the failing tests, `test/session.test.js`**

```js
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
```

- [ ] **Step 4: Run them and check they fail**

Run: `node --test test/session.test.js`
Expected: FAIL with `Cannot find module '../_lorekeeper/lib/session.js'`

- [ ] **Step 5: Write `_lorekeeper/lib/session.js`**

```js
// Sessions: Sessions/Session N.md, the current one being the highest N. Quick notes are "- HH:MM text" lines appended
// at the end. Used by the QuickAdd scripts through load.js; _lorekeeper/capture/lk-note does the same in sh.

const TEMPLATE = "_lorekeeper/templates/session.md";
const QUIET_MS = 12 * 3600 * 1000;

const sessionPath = (n) => `Sessions/Session ${n}.md`;

function latestSession(names) {
  let latest = 0;
  for (const name of names) {
    const m = name.match(/^Session (\d+)(\.md)?$/);
    if (m) latest = Math.max(latest, Number(m[1]));
  }
  return latest;
}

const isQuiet = (mtimeMs, nowMs) => nowMs - mtimeMs > QUIET_MS;

const two = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const clock = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;

function noteLine(text, now) {
  const clean = text.split(/\s+/).filter(Boolean).join(" ");
  return clean ? `- ${clock(now)} ${clean}` : null;
}

const appendLine = (content, line) => `${content}${content && !content.endsWith("\n") ? "\n" : ""}${line}\n`;

const renderSession = (template, n, date) => template.replaceAll("{{session}}", String(n)).replaceAll("{{date}}", date);

async function currentSession(io, nowMs) {
  const n = latestSession(await io.list("Sessions"));
  if (n === 0) return { n: 0, path: null, quiet: false };
  const path = sessionPath(n);
  const quiet = (await io.exists(path)) && isQuiet(await io.mtimeMs(path), nowMs);
  return { n, path, quiet };
}

async function startSession(io, n, now) {
  const path = sessionPath(n);
  if (!(await io.exists(path))) await io.write(path, renderSession(await io.read(TEMPLATE), n, isoDate(now)));
  return path;
}

async function addNote(io, path, text, now) {
  const line = noteLine(text, now);
  if (line) await io.write(path, appendLine(await io.read(path), line));
  return line;
}

module.exports = {
  TEMPLATE, sessionPath, latestSession, isQuiet, isoDate, clock, noteLine, appendLine, renderSession,
  currentSession, startSession, addNote,
};
```

- [ ] **Step 6: Run the tests and check they pass**

Run: `node --test test/session.test.js`
Expected: `# pass 10`, `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add _lorekeeper/lib/session.js _lorekeeper/templates/session.md test/helpers/io.js test/session.test.js
git commit -m "feat(Sessions): find the current session, start the next and append notes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `lk-note`, capture from outside Obsidian

**Files:**
- Create: `_lorekeeper/capture/lk-note` (executable)
- Test: `test/lk-note.test.js`

**Interfaces:**
- Consumes: `_lorekeeper/templates/session.md` (Task 3), with placeholders `{{session}}` and `{{date}}`.
- Produces: `lk-note [--vault DIR] [--next | --here] [--dialog | --stdin | TEXT…]`. Exit codes: 0 saved (prints the session file's path), 1 cancelled, 2 usage or setup error, 3 quiet session and no way to ask. `--next` always starts the next session, even with no text, so it doubles as the New session hotkey. `LK_VAULT` sets the vault, which otherwise defaults to the folder two levels above the script. `LK_NO_DIALOG=1` forbids dialogs, for tests and Windows.

- [ ] **Step 1: Write the failing tests, `test/lk-note.test.js`**

```js
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

test("text with % and quotes is saved as typed", () => {
  const dir = vault();
  run(dir, ['"50% off," said Vex']);
  assert.ok(lastLine(read(dir, 1)).endsWith(' "50% off," said Vex'));
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `node --test test/lk-note.test.js`
Expected: FAIL, every test, because `sh` can't open `lk-note`

- [ ] **Step 3: Write `_lorekeeper/capture/lk-note`**

```sh
#!/bin/sh
# Saves a quick note to the current session, the way Lorekeeper's note box does (see lib/session.js, which matches it).
#   lk-note [--vault DIR] [--next | --here] [--dialog | --stdin | TEXT...]
# --next starts the next session (with no text: just starts it). --here keeps a quiet session without asking.
# --dialog asks for the note in a system box; --stdin reads it from standard input.
# Exit: 0 saved (prints the session's path), 1 cancelled, 2 usage or setup error,
# 3 the session went quiet (no change in 12 hours) and there's no dialog to ask: rerun with --next or --here.
set -eu

vault=${LK_VAULT:-$(cd "$(dirname "$0")/../.." && pwd)}
mode=args
quiet=ask
while [ $# -gt 0 ]; do
  case $1 in
    --vault)
      [ $# -ge 2 ] || { echo "lk-note: --vault needs a folder" >&2; exit 2; }
      vault=$2
      shift 2
      ;;
    --next) quiet=next; shift ;;
    --here) quiet=here; shift ;;
    --dialog) mode=dialog; shift ;;
    --stdin) mode=stdin; shift ;;
    --) shift; break ;;
    -*) echo "lk-note: unknown option $1" >&2; exit 2 ;;
    *) break ;;
  esac
done

template=$vault/_lorekeeper/templates/session.md
[ -f "$template" ] || { echo "lk-note: $vault isn't a Lorekeeper vault (no _lorekeeper/templates/session.md)" >&2; exit 2; }

has_dialog() {
  [ "${LK_NO_DIALOG:-}" != 1 ] && { command -v osascript >/dev/null 2>&1 || command -v zenity >/dev/null 2>&1; }
}

# ask PROMPT: prints the typed text; fails when cancelled.
ask() {
  if command -v osascript >/dev/null 2>&1; then
    osascript -e 'on run argv' -e 'tell application "System Events"' -e 'activate' \
      -e 'text returned of (display dialog (item 1 of argv) default answer "" with title "Lorekeeper")' \
      -e 'end tell' -e 'end run' "$1"
  else
    zenity --entry --title=Lorekeeper --text="$1"
  fi
}

# start_next N: succeeds when the player picks Start Session N+1.
start_next() {
  next=$(($1 + 1))
  if command -v osascript >/dev/null 2>&1; then
    answer=$(osascript -e 'on run argv' -e 'tell application "System Events"' -e 'activate' \
      -e 'button returned of (display dialog (item 1 of argv) buttons {(item 2 of argv), (item 3 of argv)} default button 2 with title "Lorekeeper")' \
      -e 'end tell' -e 'end run' "Session $1 went quiet over 12 hours ago." "Keep Session $1" "Start Session $next") || return 1
    [ "$answer" = "Start Session $next" ]
  else
    zenity --question --title=Lorekeeper --text="Session $1 went quiet over 12 hours ago." \
      --ok-label="Start Session $next" --cancel-label="Keep Session $1"
  fi
}

case $mode in
  dialog)
    has_dialog || { echo "lk-note: --dialog needs osascript (macOS) or zenity (Linux)" >&2; exit 2; }
    text=$(ask "Note") || exit 1
    ;;
  stdin) text=$(cat) ;;
  *) text="$*" ;;
esac
text=$(printf '%s' "$text" | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//')

latest=0
for p in "$vault"/Sessions/Session\ *; do
  [ -e "$p" ] || continue
  n=${p##*/Session }
  n=${n%.md}
  case $n in '' | *[!0-9]*) continue ;; esac
  if [ "$n" -gt "$latest" ]; then latest=$n; fi
done

n=$latest
file="$vault/Sessions/Session $n.md"
if [ "$quiet" = next ]; then
  n=$((n + 1))
elif [ -z "$text" ]; then
  exit 0
elif [ "$n" -eq 0 ]; then
  n=1
elif [ "$quiet" = ask ] && [ -f "$file" ] && [ -n "$(find "$file" -mmin +720)" ]; then
  if [ "$mode" = args ] || ! has_dialog; then
    echo "lk-note: Session $n went quiet over 12 hours ago; rerun with --next or --here" >&2
    exit 3
  fi
  if start_next "$n"; then n=$((n + 1)); fi
fi

file="$vault/Sessions/Session $n.md"
if [ ! -e "$file" ]; then
  mkdir -p "$vault/Sessions"
  sed -e "s/{{session}}/$n/g" -e "s/{{date}}/$(date +%Y-%m-%d)/g" "$template" >"$file"
fi
if [ -n "$text" ]; then
  if [ -s "$file" ] && [ -n "$(tail -c 1 "$file")" ]; then printf '\n' >>"$file"; fi
  printf -- '- %s %s\n' "$(date +%H:%M)" "$text" >>"$file"
fi
printf '%s\n' "$file"
```

- [ ] **Step 4: Make it executable and run the tests**

Run: `chmod +x _lorekeeper/capture/lk-note && node --test test/lk-note.test.js`
Expected: `# pass 10`, `# fail 0`

- [ ] **Step 5: shellcheck**

Run: `shellcheck _lorekeeper/capture/lk-note`
Expected: no output, exit 0. Fix anything it reports. Don't silence it with `# shellcheck disable` unless the warning is a false positive, and if it is, say why in the comment.

- [ ] **Step 6: Check the dialogs and the focus on macOS (spike, manual)**

This tests the spec's focus assumption before anything depends on it.
1. `mkdir -p /tmp/lkv/_lorekeeper/templates && cp _lorekeeper/templates/session.md /tmp/lkv/_lorekeeper/templates/`
2. Open Discord (or TextEdit) and click into its message box. In Terminal run `sleep 3; sh _lorekeeper/capture/lk-note --vault /tmp/lkv --dialog`, then switch back to Discord within 3 seconds.
3. Expected: the **Lorekeeper** box appears over Discord. Type `@Vex` and press Enter. Discord is frontmost again and its message box still has the cursor. `tail -1 "/tmp/lkv/Sessions/Session 1.md"` shows `- HH:MM @Vex`.
4. `touch -t 202601010000 "/tmp/lkv/Sessions/Session 1.md"` and repeat. Expected: after the note, **Session 1 went quiet over 12 hours ago.** offers **Keep Session 1** and **Start Session 2**.
5. Press Esc in the note box. Expected: exit code 1 (`echo $?`) and nothing written.

If focus does **not** return to Discord, stop and report it. The fallback is the Shortcuts **Ask for Input** action (spec Risks), which changes Task 10.

- [ ] **Step 7: Commit**

```bash
git add _lorekeeper/capture/lk-note test/lk-note.test.js
git commit -m "feat(Capture): lk-note saves a quick note from outside Obsidian

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Pages, coins and the Obsidian loader

**Files:**
- Create: `_lorekeeper/lib/pages.js`, `_lorekeeper/lib/coins.js`, `_lorekeeper/lib/load.js`
- Test: `test/pages.test.js`, `test/coins.test.js`, `test/load.test.js`

**Interfaces:**
- Produces:
  - `pages.js`: `KIND_FOLDERS: Record<kind, folder>`; `kinds(templateNames: string[]): string[]`; `folderFor(kind: string, folders: string[]): string` (`""` means the vault root); `nameProblem(name: string, existing: string[]): string | null`
  - `coins.js`: `coinParts(text): Array<{ text: string } | { amount: string, metal: "pp"|"gp"|"ep"|"sp"|"cp" }>`; `coinsHtml(text): string`, HTML-escaped, with coins as `<span class="lk-coin lk-coin-gp" title="gp">25</span>`
  - `load.js`: `module.exports = async function lorekeeper(app): Promise<{ notes, session, pages, coins, io }>`. `io` is Task 3's interface on the vault, and writes go through `app.vault` so Obsidian knows the file at once.
  - Every Obsidian entry script loads it with exactly these three lines:
    ```js
    const m = { exports: {} };
    new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
    const lk = await m.exports(app);
    ```

- [ ] **Step 1: Write the failing tests**

`test/pages.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { kinds, folderFor, nameProblem } = require("../_lorekeeper/lib/pages.js");

test("kinds: built-ins in Lorekeeper's order, then custom ones by name", () => {
  assert.deepEqual(
    kinds(["Quest.md", "Monster.md", "NPC.md", "PC.md", "Lore.md", "Item.md", "Faction.md", "Location.md", "Deity.md", "notes.txt"]),
    ["PC", "NPC", "Location", "Item", "Faction", "Quest", "Lore", "Deity", "Monster"],
  );
});

test("folderFor: built-in folders, then Monsters or Monster, else the root", () => {
  assert.equal(folderFor("NPC", []), "NPCs");
  assert.equal(folderFor("Lore", []), "Lore");
  assert.equal(folderFor("Monster", ["Monsters", "Monster"]), "Monsters");
  assert.equal(folderFor("Monster", ["Monster"]), "Monster");
  assert.equal(folderFor("Monster", []), "");
});

test("nameProblem", () => {
  assert.equal(nameProblem("Mirela", ["Vex"]), null);
  assert.equal(nameProblem("  ", []), "Type a name.");
  assert.equal(nameProblem("A/B", []), 'A name can\'t use / \\ : * ? " < > |');
  assert.equal(nameProblem(".hidden", []), "A name can't start or end with a dot.");
  assert.equal(nameProblem("end.", []), "A name can't start or end with a dot.");
  assert.equal(nameProblem("mirela", ["Mirela"]), "There's already a page called Mirela.");
});
```

`test/coins.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { coinParts, coinsHtml } = require("../_lorekeeper/lib/coins.js");

test("coinParts finds every metal, with or without a space", () => {
  assert.deepEqual(coinParts("25gp, 3 sp and 1,200 CP"), [
    { amount: "25", metal: "gp" },
    { text: ", " },
    { amount: "3", metal: "sp" },
    { text: " and " },
    { amount: "1,200", metal: "cp" },
  ]);
  assert.deepEqual(coinParts("a magic sword"), [{ text: "a magic sword" }]);
  assert.deepEqual(coinParts("10gpx"), [{ text: "10gpx" }]);
});

test("coinsHtml escapes text and marks coins", () => {
  assert.equal(
    coinsHtml("5 pp & <b>x</b>"),
    '<span class="lk-coin lk-coin-pp" title="pp">5</span> &amp; &lt;b&gt;x&lt;/b&gt;',
  );
});
```

`test/load.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lorekeeper = require("../_lorekeeper/lib/load.js");

const ROOT = path.join(__dirname, "..");

// A fake Obsidian app: reads lib/ from the repo, keeps written files in memory.
function fakeApp() {
  const files = new Map();
  const folders = new Set(["Sessions"]);
  const created = [];
  const vault = {
    adapter: {
      read: async (p) => (files.has(p) ? files.get(p) : fs.readFileSync(path.join(ROOT, p), "utf8")),
      exists: async (p) => files.has(p) || folders.has(p),
      list: async (dir) => ({
        files: [...files.keys()].filter((p) => path.dirname(p) === dir),
        folders: [...folders].filter((p) => path.dirname(p) === dir),
      }),
      stat: async () => ({ mtime: 1000 }),
    },
    getAbstractFileByPath: (p) => (files.has(p) ? { path: p } : folders.has(p) ? { path: p, children: [] } : null),
    modify: async (f, text) => files.set(f.path, text),
    create: async (p, text) => (created.push(p), files.set(p, text)),
    createFolder: async (p) => folders.add(p),
  };
  return { app: { vault }, files, folders, created };
}

test("loads every lib module", async () => {
  const lk = await lorekeeper(fakeApp().app);
  assert.equal(lk.notes.SECTIONS.length, 6);
  assert.equal(lk.session.sessionPath(2), "Sessions/Session 2.md");
  assert.equal(typeof lk.pages.nameProblem, "function");
  assert.equal(typeof lk.coins.coinsHtml, "function");
});

test("io writes through the vault, making folders", async () => {
  const { app, files, folders, created } = fakeApp();
  const { io } = await lorekeeper(app);
  await io.write("Quests/Find the miners.md", "a");
  assert.ok(folders.has("Quests"));
  assert.deepEqual(created, ["Quests/Find the miners.md"]);
  await io.write("Quests/Find the miners.md", "b");
  assert.equal(files.get("Quests/Find the miners.md"), "b");
  assert.deepEqual(created, ["Quests/Find the miners.md"]);
});

test("io.list gives names, and [] for a missing folder", async () => {
  const { app } = fakeApp();
  const { io } = await lorekeeper(app);
  await io.write("Sessions/Session 1.md", "x");
  assert.deepEqual(await io.list("Sessions"), ["Session 1.md"]);
  assert.deepEqual(await io.list("Nope"), []);
  assert.equal(await io.mtimeMs("Sessions/Session 1.md"), 1000);
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `node --test test/pages.test.js test/coins.test.js test/load.test.js`
Expected: FAIL with `Cannot find module` for each

- [ ] **Step 3: Write `_lorekeeper/lib/pages.js`**

```js
// Page kinds: one per file in Templates/, each with its folder (Lorekeeper's New page).

const KIND_FOLDERS = { PC: "PCs", NPC: "NPCs", Location: "Locations", Item: "Items", Faction: "Factions", Quest: "Quests", Lore: "Lore" };
const BUILT_IN = Object.keys(KIND_FOLDERS);

function kinds(templateNames) {
  const names = templateNames.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
  const custom = names.filter((n) => !BUILT_IN.includes(n)).sort((a, b) => a.localeCompare(b));
  return [...BUILT_IN.filter((k) => names.includes(k)), ...custom];
}

function folderFor(kind, folders) {
  if (KIND_FOLDERS[kind]) return KIND_FOLDERS[kind];
  if (folders.includes(`${kind}s`)) return `${kind}s`;
  return folders.includes(kind) ? kind : "";
}

function nameProblem(name, existing) {
  const n = name.trim();
  if (!n) return "Type a name.";
  if (/[/\\:*?"<>|]/.test(n)) return 'A name can\'t use / \\ : * ? " < > |';
  if (n.startsWith(".") || n.endsWith(".")) return "A name can't start or end with a dot.";
  const taken = existing.find((e) => e.toLowerCase() === n.toLowerCase());
  return taken ? `There's already a page called ${taken}.` : null;
}

module.exports = { KIND_FOLDERS, kinds, folderFor, nameProblem };
```

- [ ] **Step 4: Write `_lorekeeper/lib/coins.js`**

```js
// Coin amounts in quest rewards ("25gp", "3 sp"), shown with their metal's coin (Lorekeeper's reward icons).

const COIN = /\b(\d[\d,]*) ?(pp|gp|ep|sp|cp)\b/gi;

function coinParts(text) {
  const parts = [];
  let at = 0;
  for (const m of text.matchAll(COIN)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ amount: m[1], metal: m[2].toLowerCase() });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const coinsHtml = (text) =>
  coinParts(text)
    .map((p) => ("text" in p ? escape(p.text) : `<span class="lk-coin lk-coin-${p.metal}" title="${p.metal}">${p.amount}</span>`))
    .join("");

module.exports = { coinParts, coinsHtml };
```

- [ ] **Step 5: Write `_lorekeeper/lib/load.js`**

```js
// Loads _lorekeeper/lib inside Obsidian, where Node's require can't reach the vault (and mobile has none). Each lib
// module is CommonJS with no requires of its own. Entry scripts run this file with new Function and await it with app.

const MODULES = ["notes", "session", "pages", "coins"];

module.exports = async function lorekeeper(app) {
  const { vault } = app;
  const { adapter } = vault;
  const lk = {};
  for (const name of MODULES) {
    const m = { exports: {} };
    new Function("module", "exports", await adapter.read(`_lorekeeper/lib/${name}.js`))(m, m.exports);
    lk[name] = m.exports;
  }
  lk.io = {
    async list(dir) {
      if (!(await adapter.exists(dir))) return [];
      const { files, folders } = await adapter.list(dir);
      return [...files, ...folders].map((p) => p.split("/").pop());
    },
    exists: (p) => adapter.exists(p),
    read: (p) => adapter.read(p),
    async write(p, text) {
      const file = vault.getAbstractFileByPath(p);
      if (file) return vault.modify(file, text);
      const dir = p.split("/").slice(0, -1).join("/");
      if (dir && !vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
      await vault.create(p, text);
    },
    mtimeMs: async (p) => (await adapter.stat(p)).mtime,
  };
  return lk;
};
```

- [ ] **Step 6: Run the tests and check they pass**

Run: `npm test`
Expected: every suite passes, `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add _lorekeeper/lib/pages.js _lorekeeper/lib/coins.js _lorekeeper/lib/load.js test/pages.test.js test/coins.test.js test/load.test.js
git commit -m "feat(Pages): page kinds, name checks, coin rewards and the Obsidian loader

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Obsidian config, plugins, templates and the kind picker

**Files:**
- Create: `plugin-versions.txt`, `scripts/update-plugins.sh`
- Create: `.obsidian/app.json`, `.obsidian/appearance.json`, `.obsidian/core-plugins.json`, `.obsidian/community-plugins.json`, `.obsidian/graph.json`
- Create: `.obsidian/plugins/{quickadd,templater-obsidian,dataview,custom-selectors}/` (downloaded), plus `data.json` for `templater-obsidian`, `dataview` and `custom-selectors`
- Create: `Templates/PC.md`, `NPC.md`, `Location.md`, `Item.md`, `Faction.md`, `Quest.md`, `Lore.md`
- Create: `_lorekeeper/templates/pick-kind.md`
- Test: `test/config.test.js`

**Interfaces:**
- Consumes: `pages.kinds`, `pages.folderFor` and `io` via the load.js boot lines (Task 5).
- Produces: a vault that opens in Obsidian with the four plugins on. Templater folder templates map each kind folder to its template, and the vault root to `pick-kind.md`.

- [ ] **Step 1: Write `plugin-versions.txt`**

```
# id repo version: scripts/update-plugins.sh downloads these into .obsidian/plugins/<id>/
quickadd chhoumann/quickadd 2.32.1
templater-obsidian SilentVoid13/Templater 2.25.1
dataview blacksmithgu/obsidian-dataview 0.5.70
custom-selectors hodie/obsidian-custom-selectors 1.1.0
```

- [ ] **Step 2: Write `scripts/update-plugins.sh`, then run it**

```sh
#!/bin/sh
# Downloads the plugin versions in plugin-versions.txt into .obsidian/plugins/<id>/. Settings (data.json) are kept.
set -eu
cd "$(dirname "$0")/.."
grep -v '^#' plugin-versions.txt | while read -r id repo version; do
  [ -n "$id" ] || continue
  dir=.obsidian/plugins/$id
  mkdir -p "$dir"
  for f in main.js manifest.json; do
    curl -fsSL "https://github.com/$repo/releases/download/$version/$f" -o "$dir/$f"
  done
  curl -fsSL "https://github.com/$repo/releases/download/$version/styles.css" -o "$dir/styles.css" || rm -f "$dir/styles.css"
  echo "$id $version"
done
```

Run: `chmod +x scripts/update-plugins.sh && scripts/update-plugins.sh && shellcheck scripts/update-plugins.sh`
Expected: four lines `quickadd 2.32.1` … `custom-selectors 1.1.0`, and no shellcheck output.

- [ ] **Step 3: Write the Obsidian settings**

`.obsidian/app.json`:

```json
{
  "alwaysUpdateLinks": true,
  "newFileLocation": "root",
  "attachmentFolderPath": "Attachments",
  "newLinkFormat": "shortest",
  "useMarkdownLinks": false,
  "showInlineTitle": true,
  "promptDelete": true,
  "userIgnoreFilters": ["_lorekeeper/"]
}
```

`.obsidian/appearance.json`:

```json
{ "theme": "system", "cssTheme": "Lorekeeper", "baseFontSize": 16 }
```

`.obsidian/core-plugins.json`:

```json
{
  "file-explorer": true, "global-search": true, "switcher": true, "graph": true, "backlink": true,
  "outgoing-link": true, "properties": true, "page-preview": true, "bookmarks": true, "bases": true,
  "command-palette": true, "editor-status": true, "word-count": false, "templates": false,
  "daily-notes": false, "tag-pane": false, "canvas": false, "file-recovery": true, "sync": false
}
```

`.obsidian/community-plugins.json`:

```json
["quickadd", "templater-obsidian", "dataview", "custom-selectors"]
```

`.obsidian/graph.json` (Connections: no sessions, templates or scripts. The colours are Lorekeeper's Tome kind colours as integers: NPC `#1a3f63` = 1720163, quest `#213f1b` = 2179867):

```json
{
  "search": "-path:Sessions -path:Templates -path:_lorekeeper -path:Attachments",
  "showTags": false,
  "showAttachments": false,
  "hideUnresolved": true,
  "showOrphans": true,
  "colorGroups": [
    { "query": "path:NPCs", "color": { "a": 1, "rgb": 1720163 } },
    { "query": "path:Quests", "color": { "a": 1, "rgb": 2179867 } }
  ]
}
```

`.obsidian/plugins/dataview/data.json`:

```json
{ "enableDataviewJs": true, "enableInlineDataviewJs": false }
```

`.obsidian/plugins/custom-selectors/data.json`:

```json
{
  "selectors": [
    { "name": "status", "options": ["open", "in progress", "done", "failed"], "defaultFirst": true },
    { "name": "condition", "options": ["alive", "dead", "missing", "unknown"], "defaultFirst": false },
    { "name": "attitude", "options": ["friendly", "neutral", "hostile", "unknown"], "defaultFirst": false }
  ]
}
```

`.obsidian/plugins/templater-obsidian/data.json`:

```json
{
  "templates_folder": "Templates",
  "trigger_on_file_creation": true,
  "trigger_on_file_creation_mode": "folder",
  "folder_templates": [
    { "folder": "/", "template": "_lorekeeper/templates/pick-kind.md" },
    { "folder": "PCs", "template": "Templates/PC.md" },
    { "folder": "NPCs", "template": "Templates/NPC.md" },
    { "folder": "Locations", "template": "Templates/Location.md" },
    { "folder": "Items", "template": "Templates/Item.md" },
    { "folder": "Factions", "template": "Templates/Faction.md" },
    { "folder": "Quests", "template": "Templates/Quest.md" },
    { "folder": "Lore", "template": "Templates/Lore.md" }
  ],
  "user_scripts_folder": "_lorekeeper/scripts/templater",
  "ignore_folders_on_creation": ["Sessions", "Templates", "_lorekeeper", "Attachments", "Private"],
  "enable_system_commands": false
}
```

- [ ] **Step 4: Write the seven templates** (Lorekeeper's properties and sections from `lib.rs:55-61`, with NPC `status` renamed `condition`, no `# title` heading, and Templater dates)

`Templates/PC.md`:

```markdown
---
type: pc
player:
class:
race:
level:
background:
alignment:
portrait:
dndbeyond:
---
## Appearance

## Personality

## Goals

## Relationships

## Notes
```

`Templates/NPC.md`:

```markdown
---
type: npc
race:
role:
location:
condition: alive
attitude:
first-met: <% tp.date.now("YYYY-MM-DD") %>
---
## Description

## Notes
```

`Templates/Location.md`:

```markdown
---
type: location
region:
---
## Description

## Notable people

## Notes
```

`Templates/Item.md`:

```markdown
---
type: item
rarity:
owner:
---
## Description

## Notes
```

`Templates/Faction.md`:

```markdown
---
type: faction
leader:
base:
---
## Goals

## Members

## Notes
```

`Templates/Quest.md`:

```markdown
---
type: quest
status: open
giver:
location:
reward:
started: <% tp.date.now("YYYY-MM-DD") %>
---
## Objective

## Leads

## Log
```

`Templates/Lore.md`:

```markdown
---
type: lore
category:
source:
learned: <% tp.date.now("YYYY-MM-DD") %>
---
## Description

## Notes
```

- [ ] **Step 5: Write the kind picker, `_lorekeeper/templates/pick-kind.md`** (Templater runs it on any new note at the vault root, for example after clicking a link to a page that doesn't exist yet)

```
<%*
const m = { exports: {} };
new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
const { pages, io } = await m.exports(app);
const kinds = pages.kinds(await io.list("Templates"));
const kind = await tp.system.suggester(["Plain note", ...kinds], ["", ...kinds], false, `What is ${tp.file.title}?`);
if (kind) {
  const folders = app.vault.getRoot().children.filter((f) => "children" in f).map((f) => f.name);
  const folder = pages.folderFor(kind, folders);
  if (folder) {
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    await tp.file.move(`${folder}/${tp.file.title}`);
  }
  tR += await tp.file.include(`[[Templates/${kind}]]`);
}
%>
```

- [ ] **Step 6: Write `test/config.test.js`** (catches broken JSON and drift between config files)

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const json = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

test("every enabled plugin is pinned and downloaded", () => {
  const pinned = fs.readFileSync(path.join(ROOT, "plugin-versions.txt"), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(" "));
  assert.deepEqual(json(".obsidian/community-plugins.json").sort(), pinned.map(([id]) => id).sort());
  for (const [id, , version] of pinned) assert.equal(json(`.obsidian/plugins/${id}/manifest.json`).version, version, id);
});

test("every folder template exists", () => {
  for (const { template } of json(".obsidian/plugins/templater-obsidian/data.json").folder_templates)
    assert.ok(fs.existsSync(path.join(ROOT, template)), template);
});

test("selectors match the templates' starting values", () => {
  const sel = Object.fromEntries(json(".obsidian/plugins/custom-selectors/data.json").selectors.map((s) => [s.name, s.options]));
  assert.ok(sel.status.includes("open") && fs.readFileSync(path.join(ROOT, "Templates/Quest.md"), "utf8").includes("status: open"));
  assert.ok(sel.condition.includes("alive") && fs.readFileSync(path.join(ROOT, "Templates/NPC.md"), "utf8").includes("condition: alive"));
});
```

Run: `npm test`
Expected: `# fail 0`

- [ ] **Step 7: Check it in Obsidian (spike, manual)**

This tests the spec's on-create assumption. Use a throwaway copy so Obsidian's own files don't get into the repo: `rm -rf /tmp/lk-try && cp -R . /tmp/lk-try && rm -rf /tmp/lk-try/.git`. In Obsidian choose **Open folder as vault** and pick `/tmp/lk-try`, then **Trust author and enable plugins**.
1. **Settings > Community plugins** lists all four, turned on.
2. In a new note at the root, type `[[Halia Thornton]]`, switch to Reading view and click the link. Expected: **What is Halia Thornton?** offers **Plain note**, PC, NPC, …, Lore. Pick NPC. Expected: the page is in `NPCs/`, with `condition: alive` and today's `first-met`.
3. Right-click `Quests/` and choose **New note**. Expected: it gets the Quest template, and **status** shows as a dropdown.
4. Run `sh _lorekeeper/capture/lk-note --vault /tmp/lk-try hello`. Expected: `Sessions/Session 1.md` appears in Obsidian **without** the kind picker opening (Sessions is ignored).

If step 2 doesn't open the picker, check that Templater accepts `"/"` as the root folder: open **Settings > Templater > Folder templates** and see whether the root entry shows. If not, set it there and copy the folder value Templater saved into `data.json`. Report any change.

- [ ] **Step 8: Commit**

```bash
git add plugin-versions.txt scripts/update-plugins.sh .obsidian Templates _lorekeeper/templates/pick-kind.md test/config.test.js
git commit -m "feat(Pages): vault settings, pinned plugins, page templates and the kind picker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Session view and the QuickAdd commands

**Files:**
- Create: `_lorekeeper/scripts/session.js` (DataviewJS view)
- Create: `_lorekeeper/scripts/quick-note.js`, `new-session.js`, `open-session.js`, `new-page.js`, `open-cheat-sheet.js` (QuickAdd user scripts)
- Modify: `.obsidian/plugins/quickadd/data.json` (created by the QuickAdd UI), `.obsidian/hotkeys.json` (created by the Hotkeys UI)
- Test: `test/scripts.test.js`

**Interfaces:**
- Consumes: `notes.merge`, `notes.SECTIONS`, `coins.coinsHtml`, `session.*`, `pages.*` and `io`, all via the load.js boot lines.
- Produces: the QuickAdd commands **Quick note**, **New session**, **Current session**, **New page** and **Cheat sheet**. Their hotkeys: `⌘⌥N`, none, `⌘J`, `⌘N` and `⌘/`. Also `⌘K` for search.

- [ ] **Step 1: Write a test that every script parses and boots the same way, `test/scripts.test.js`**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "_lorekeeper/scripts");
const BOOT = 'new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);';
const AsyncFunction = (async () => {}).constructor;

for (const name of ["session.js", "quick-note.js", "new-session.js", "open-session.js", "new-page.js", "open-cheat-sheet.js"]) {
  test(`${name} parses and boots lib through load.js`, () => {
    const src = fs.readFileSync(path.join(DIR, name), "utf8");
    assert.doesNotThrow(() => new AsyncFunction("dv", "input", "module", "app", src));
    if (name !== "open-cheat-sheet.js") assert.ok(src.includes(BOOT), "uses the load.js boot lines");
  });
}
```

Run: `node --test test/scripts.test.js`
Expected: FAIL with `ENOENT` for each script

- [ ] **Step 2: Write the session view, `_lorekeeper/scripts/session.js`**

```js
// The view at the top of every session page (dv.view, see _lorekeeper/templates/session.md): open quests, then the
// session's notes as a Timeline or a Journal. Reads Session N.md and any per-author files in Session N/.
const m = { exports: {} };
new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
const { notes, coins, io } = await m.exports(app);

const file = input.file;
const parts = [{ author: "", text: await io.read(file) }];
const folder = file.replace(/\.md$/, "");
for (const name of (await io.list(folder)).filter((n) => n.endsWith(".md")).sort())
  parts.push({ author: name.slice(0, -3), text: await io.read(`${folder}/${name}`) });
const all = notes.merge(parts);

const root = dv.el("div", "", { cls: "lk-session-view" });
const title = dv.page(file)?.title;
if (title) dv.el("div", String(title), { container: root, cls: "lk-session-title" });

const quests = dv.pages('"Quests"').where((p) => p.status === "open" || p.status === "in progress");
if (quests.length) {
  const box = dv.el("div", "", { container: root, cls: "lk-open-quests" });
  dv.el("div", "Open quests", { container: box, cls: "lk-rubric" });
  for (const q of quests) {
    const reward = q.reward ? ` · ${coins.coinsHtml(String(q.reward))}` : "";
    const status = q.status === "in progress" ? " · in progress" : "";
    dv.el("div", `${q.file.link}${status}${reward}`, { container: box, cls: "lk-quest" });
  }
}

if (!all.length) {
  dv.el("p", "No notes yet. Press ⌘⌥N (Ctrl+Alt+N) during the game, or type `- ` lines under Notes.", { container: root, cls: "lk-empty" });
} else {
  const tabs = dv.el("div", "", { container: root, cls: "lk-tabs" });
  const timeline = dv.el("div", "", { container: root, cls: "lk-timeline" });
  const journal = dv.el("div", "", { container: root, cls: "lk-journal" });
  const line = (n) =>
    `${n.time ? `<span class="lk-time">${n.time}</span> ` : ""}${n.text}${n.author ? ` <span class="lk-author">${n.author}</span>` : ""}`;
  for (const n of all) dv.el("div", line(n), { container: timeline, cls: `lk-note lk-kind-${n.kind}` });
  for (const [kind, label] of notes.SECTIONS) {
    const items = all.filter((n) => n.kind === kind);
    if (!items.length) continue;
    dv.el("div", label, { container: journal, cls: `lk-rubric lk-kind-${kind}` });
    for (const n of items) dv.el("div", line(n), { container: journal, cls: `lk-note lk-kind-${kind}` });
  }
  let mode = "timeline";
  try { mode = localStorage.getItem("lorekeeper-session-view") || mode; } catch {}
  const buttons = {};
  const show = (which) => {
    mode = which;
    timeline.hidden = which !== "timeline";
    journal.hidden = which !== "journal";
    for (const [k, b] of Object.entries(buttons)) b.toggleClass("is-active", k === which);
    try { localStorage.setItem("lorekeeper-session-view", which); } catch {}
  };
  for (const [k, label] of [["timeline", "Timeline"], ["journal", "Journal"]]) {
    buttons[k] = tabs.createEl("button", { text: label });
    buttons[k].addEventListener("click", () => show(k));
  }
  show(mode);
}
```

- [ ] **Step 3: Write `_lorekeeper/scripts/quick-note.js`**

```js
// QuickAdd: Quick note. Opens the current session (offering the next when it went quiet), adds a "- HH:MM " line at
// the end and puts the cursor on it, so Obsidian's [[ suggestions work while typing.
module.exports = async ({ app, quickAddApi }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, io } = await m.exports(app);
  const now = new Date();
  const current = await session.currentSession(io, now.getTime());
  let n = current.n || 1;
  if (current.quiet) {
    const next = await quickAddApi
      .yesNoPrompt(`Start Session ${n + 1}?`, `Session ${n} went quiet over 12 hours ago.`)
      .catch(() => false);
    if (next) n += 1;
  }
  const path = await session.startSession(io, n, now);
  const prefix = `- ${session.clock(now)} `;
  await io.write(path, session.appendLine(await io.read(path), prefix));
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(app.vault.getAbstractFileByPath(path), { state: { mode: "source" } });
  const editor = leaf.view.editor;
  const line = editor.lastLine() - 1; // appendLine ends with a newline
  editor.setCursor({ line, ch: editor.getLine(line).length });
  editor.focus();
};
```

- [ ] **Step 4: Write `_lorekeeper/scripts/new-session.js`**

```js
// QuickAdd: New session. Starts the next session and opens it.
module.exports = async ({ app }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, io } = await m.exports(app);
  const now = new Date();
  const { n } = await session.currentSession(io, now.getTime());
  const path = await session.startSession(io, n + 1, now);
  await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
};
```

- [ ] **Step 5: Write `_lorekeeper/scripts/open-session.js`**

```js
// QuickAdd: Current session. Opens the newest session.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, io } = await m.exports(app);
  const { n } = await session.currentSession(io, Date.now());
  if (!n) return new obsidian.Notice("No sessions yet. Quick note (⌘⌥N or Ctrl+Alt+N) starts Session 1.");
  const path = await session.startSession(io, n, new Date()); // a folder-only session gets its page
  await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
};
```

- [ ] **Step 6: Write `_lorekeeper/scripts/new-page.js`**

```js
// QuickAdd: New page. Asks what you're making (a file in Templates/) and its name, then has Templater make the page
// in that kind's folder and opens it.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { pages, io } = await m.exports(app);
  const templater = app.plugins.plugins["templater-obsidian"]?.templater;
  if (!templater) return new obsidian.Notice("New page needs the Templater plugin turned on.");
  const asked = (promise) => promise.catch(() => null); // QuickAdd rejects on Esc
  const kinds = pages.kinds(await io.list("Templates"));
  const kind = await asked(quickAddApi.suggester(kinds, kinds));
  if (!kind) return;
  const existing = app.vault.getMarkdownFiles().map((f) => f.basename);
  let name;
  for (;;) {
    name = (await asked(quickAddApi.inputPrompt(`New ${kind}`, "Name")))?.trim();
    if (!name) return;
    const problem = pages.nameProblem(name, existing);
    if (!problem) break;
    new obsidian.Notice(problem);
  }
  const folders = app.vault.getRoot().children.filter((f) => "children" in f).map((f) => f.name);
  const folder = pages.folderFor(kind, folders);
  if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  await templater.create_new_note_from_template(
    app.vault.getAbstractFileByPath(`Templates/${kind}.md`),
    folder ? app.vault.getAbstractFileByPath(folder) : app.vault.getRoot(),
    name,
    true,
  );
};
```

- [ ] **Step 7: Write `_lorekeeper/scripts/open-cheat-sheet.js`**

```js
// QuickAdd: Cheat sheet. Opens Cheat Sheet.md.
module.exports = async ({ app, obsidian }) => {
  const file = app.vault.getAbstractFileByPath("Cheat Sheet.md");
  if (!file) return new obsidian.Notice("Cheat Sheet.md is missing from the vault.");
  await app.workspace.getLeaf(false).openFile(file);
};
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: `# fail 0`

- [ ] **Step 9: Set up the QuickAdd commands in Obsidian (manual, then commit the file Obsidian writes)**

Do this in the repo vault itself so `.obsidian/plugins/quickadd/data.json` is written there. Open `~/Projects/_private_projects/lorekeeper-obsidian` as a vault. Then in **Settings > QuickAdd**, add five **Macro** choices with these exact names, each with a single **User Script** step:

| Choice name | User script |
|---|---|
| `Quick note` | `_lorekeeper/scripts/quick-note.js` |
| `New session` | `_lorekeeper/scripts/new-session.js` |
| `Current session` | `_lorekeeper/scripts/open-session.js` |
| `New page` | `_lorekeeper/scripts/new-page.js` |
| `Cheat sheet` | `_lorekeeper/scripts/open-cheat-sheet.js` |

Turn on the ⚡ (command) toggle for each. Then in **Settings > Hotkeys**, set:

| Command | Hotkey |
|---|---|
| QuickAdd: Quick note | `⌘⌥N` |
| QuickAdd: Current session | `⌘J` |
| QuickAdd: New page | `⌘N` |
| QuickAdd: Cheat sheet | `⌘/` |
| Search: Search in all files | `⌘K` |
| Insert Markdown link | remove its `⌘K` |
| Create new note | remove its `⌘N` |

Obsidian stores `Mod`, so the same hotkeys are `Ctrl` on Windows and Linux.

- [ ] **Step 10: Check it in Obsidian (manual)**

1. `⌘⌥N` with no sessions: `Session 1` opens with the cursor after `- HH:MM `. Type `@[[Mir` and confirm the link suggestions appear, then finish as `@[[Mirela]] shifty innkeeper`. Switch to Reading view: the Timeline shows it with the NPC colour, and **Journal** groups it under **NPCs**.
2. Press `⌘⌥N` and then Esc without typing. Reading view shows no empty note.
3. `⌘N`, **NPC**, `Mirela`: refused with **There's already a page called Mirela.** if Mirela exists, otherwise created in `NPCs/` and opened.
4. A Quest with `reward: 25gp` and status **open** shows under **Open quests** on the session page, with a gold coin.
5. Add `title: The bridge collapse` to the session's properties: the view shows it above the open quests.
6. `⌘J` opens the newest session, and `⌘/` opens the cheat sheet (after Task 8).
7. Quit Obsidian, then `git status`: only `.obsidian/plugins/quickadd/data.json`, `.obsidian/hotkeys.json` and maybe `.obsidian/app.json`/`appearance.json` changed. Revert anything else Obsidian wrote (`git checkout -- <file>`), apart from those, before committing.

- [ ] **Step 11: Commit**

```bash
git add _lorekeeper/scripts test/scripts.test.js .obsidian/plugins/quickadd/data.json .obsidian/hotkeys.json
git commit -m "feat(Sessions): session pages show a Timeline and Journal; quick note, new page and session commands

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Home, Bases and the cheat sheet

**Files:**
- Create: `Home.md`, `Cheat Sheet.md`, `_lorekeeper/bases/quests.base`, `_lorekeeper/bases/npcs.base`, `_lorekeeper/bases/sessions.base`
- Modify: `.obsidian/app.json` (no change needed if Home is opened by bookmark), `test/config.test.js`

**Interfaces:**
- Consumes: the properties from Task 6's templates and `title` on sessions.
- Produces: `Home.md`, bookmarked, and `Cheat Sheet.md`, opened by Task 7's command.

- [ ] **Step 1: Write `_lorekeeper/bases/quests.base`**

```yaml
filters:
  and:
    - file.inFolder("Quests")
views:
  - type: table
    name: Open quests
    filters:
      or:
        - status == "open"
        - status == "in progress"
    order:
      - file.name
      - status
      - giver
      - reward
  - type: table
    name: All quests
    order:
      - file.name
      - status
      - giver
      - reward
      - started
```

- [ ] **Step 2: Write `_lorekeeper/bases/npcs.base`**

```yaml
filters:
  and:
    - file.inFolder("NPCs")
views:
  - type: table
    name: NPCs
    groupBy:
      property: attitude
      direction: ASC
    order:
      - file.name
      - condition
      - attitude
      - role
      - location
```

- [ ] **Step 3: Write `_lorekeeper/bases/sessions.base`**

```yaml
filters:
  and:
    - file.folder == "Sessions"
views:
  - type: table
    name: Recent sessions
    order:
      - file.name
      - title
      - date
    sort:
      - property: session
        direction: DESC
    limit: 10
```

- [ ] **Step 4: Write `Home.md`**

```markdown
## Open quests

![[_lorekeeper/bases/quests.base#Open quests]]

## Recent sessions

![[_lorekeeper/bases/sessions.base]]

## NPCs

![[_lorekeeper/bases/npcs.base]]

---

**Connections:** open the graph (**⌘G** or **Ctrl+G**). **Cheat sheet:** **⌘/** or **Ctrl+/**. **New page:** **⌘N** or **Ctrl+N**.
```

- [ ] **Step 5: Write `Cheat Sheet.md`**

```markdown
## Note symbols

Start a note with a symbol to file it. It works in the note box and on any line under **Notes** in a session.

| Symbol | Goes to |
|---|---|
| `@` | NPCs |
| `#` | Loot |
| `!` | Quests |
| `?` | Mysteries |
| `"` | Quotes |
| none | What happened |

## Links and images

- `[[Mirela]]` links a page. `@[[Mirela]]` files the note under NPCs and links her.
- `![[map.png]]` shows an image from `Attachments/`. Add `|300` for a width: `![[map.png|300]]`.
- Paste or drop an image into a page to save it in `Attachments/`.

## Anywhere

| Shortcut | What it does |
|---|---|
| `⌘⌥N` / `Ctrl+Alt+N` | Note box over any app (after setting up capture, see the README) |
| `⌘⇧S` / `Ctrl+Shift+S` | Saves the selected text, or the clipboard |

## In Obsidian

| Shortcut | What it does |
|---|---|
| `⌘⌥N` / `Ctrl+Alt+N` | Quick note: a new line in the current session, with link suggestions |
| `⌘J` / `Ctrl+J` | Current session |
| `⌘N` / `Ctrl+N` | New page: NPC, PC, Location, Item, Faction, Quest, Lore or your own |
| `⌘K` / `Ctrl+K` | Search |
| `⌘O` / `Ctrl+O` | Open a page by name |
| `⌘G` / `Ctrl+G` | Connections (the graph) |
| `⌘/` / `Ctrl+/` | This cheat sheet |
| `⌘E` / `Ctrl+E` | Switch between editing and reading |
| `F2` | Rename the page: links to it follow |
```

- [ ] **Step 6: Bookmark Home** (manual, in the repo vault): right-click `Home.md`, **Bookmark**. Commit `.obsidian/bookmarks.json`.

- [ ] **Step 7: Add a test that Home's embeds exist, appended to `test/config.test.js`**

```js
test("Home embeds only bases that exist", () => {
  const home = fs.readFileSync(path.join(ROOT, "Home.md"), "utf8");
  const embeds = [...home.matchAll(/!\[\[([^\]#|]+)/g)].map((m) => m[1]);
  assert.equal(embeds.length, 3);
  for (const e of embeds) assert.ok(fs.existsSync(path.join(ROOT, e)), e);
});
```

Run: `npm test`
Expected: `# fail 0`

- [ ] **Step 8: Check it in Obsidian (manual)**, with two quests (one open, one done), two NPCs (friendly and hostile) and two sessions (one with `title: The bridge collapse`):
1. **Open quests** lists only the open one, and its **status** cell is a dropdown. If it isn't, change the column to `selector.status` in `quests.base` (Custom Selectors' README) and note that in the commit.
2. **NPCs** is grouped by attitude. If Obsidian reports `groupBy` as unknown, replace it with `sort: [{ property: attitude, direction: ASC }]`.
3. **Recent sessions** shows Session 2 first with its title.
4. Any parse error in a `.base` file appears in the embed. Fix it using Obsidian's Bases help (**Help > Bases syntax**), and keep the meaning.

- [ ] **Step 9: Commit**

```bash
git add Home.md "Cheat Sheet.md" _lorekeeper/bases .obsidian/bookmarks.json test/config.test.js
git commit -m "feat(Home): open quests, recent sessions and NPCs, plus a cheat sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The Lorekeeper theme

**Files:**
- Create: `theme/upstream/styles.css`, `theme/upstream/icons.js`, `theme/upstream/fonts/*` (copied verbatim from Lorekeeper), `theme/upstream/README.md`
- Create: `theme/theme.src.css`, `scripts/build-theme.js`, `.obsidian/themes/Lorekeeper/manifest.json`, `.obsidian/themes/Lorekeeper/theme.css` (generated)
- Test: `test/theme.test.js`

**Interfaces:**
- Consumes: the class names the session view emits (Task 7): `lk-session-view`, `lk-session-title`, `lk-open-quests`, `lk-rubric`, `lk-quest`, `lk-tabs`, `lk-timeline`, `lk-journal`, `lk-note`, `lk-kind-<kind>`, `lk-time`, `lk-author`, `lk-empty`, `lk-coin`, `lk-coin-<metal>`.
- Produces: `build()`, `tokens(css, re, name)` and `icons(js)` exported from `scripts/build-theme.js`. `npm run build:theme` writes `theme.css`, and `npm run check:theme` fails when it's stale.

- [ ] **Step 1: Copy Lorekeeper's design files**

```bash
LK=~/Projects/_private_projects/lorekeeper
mkdir -p theme/upstream/fonts
cp "$LK/src/styles.css" theme/upstream/styles.css
cp "$LK/src/icons.js" theme/upstream/icons.js
cp "$LK"/src/fonts/*.woff2 "$LK/src/fonts/LICENSE-Solbera.txt" "$LK/src/fonts/README.md" theme/upstream/fonts/
printf '# Upstream\n\nVerbatim copies from Lorekeeper (https://github.com/yonatankarp/lorekeeper) at commit 32a07f6: src/styles.css, src/icons.js and src/fonts/. To update, copy them again and run npm run build:theme. Never edit them here.\n' > theme/upstream/README.md
```

- [ ] **Step 2: Write the failing tests, `test/theme.test.js`**

```js
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
  for (const cls of classes) assert.ok(css.includes(`.${cls}`), cls);
  for (const kind of ["event", "npc", "loot", "quest", "mystery", "quote"]) assert.ok(css.includes(`.lk-kind-${kind}`), kind);
});

test("theme.css is up to date", () => {
  assert.equal(fs.readFileSync(path.join(ROOT, ".obsidian/themes/Lorekeeper/theme.css"), "utf8"), css);
});
```

Run: `node --test test/theme.test.js`
Expected: FAIL with `Cannot find module '../scripts/build-theme.js'`

- [ ] **Step 3: Write `scripts/build-theme.js`**

```js
// Builds .obsidian/themes/Lorekeeper/theme.css: Lorekeeper's Tome and Dungeon tokens (theme/upstream/styles.css),
// renamed --lk-*, as .theme-light and .theme-dark, then theme/theme.src.css with its fonts inlined, then a kind icon
// for each campaign folder (theme/upstream/icons.js). `--check` fails when theme.css is stale.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, ".obsidian/themes/Lorekeeper/theme.css");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const FOLDER_ICONS = { PCs: "pc", NPCs: "npc", Locations: "location", Items: "item", Factions: "faction", Quests: "quest", Lore: "lore", Sessions: "session" };

function tokens(css, re, name) {
  const m = css.match(re);
  if (!m) throw new Error(`build-theme: no ${name} tokens in theme/upstream/styles.css`);
  return m[1].replace(/--([a-z])/g, "--lk-$1");
}

function icons(js) {
  const out = {};
  for (const m of js.matchAll(/^\s*(\w+): `([^`]*)`/gm)) out[m[1]] = m[2];
  return out;
}

function iconCss(paths) {
  return Object.entries(FOLDER_ICONS)
    .map(([folder, icon]) => {
      if (!paths[icon]) throw new Error(`build-theme: no "${icon}" icon in theme/upstream/icons.js`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="black" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[icon].replaceAll("currentColor", "black")}</svg>`;
      const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      return `.nav-folder-title[data-path="${folder}"] .nav-folder-title-content::before { -webkit-mask-image: ${url}; mask-image: ${url}; }`;
    })
    .join("\n");
}

function inlineFonts(css) {
  return css.replace(/url\("fonts\/([^"]+\.woff2)"\)/g, (_, file) => {
    const data = fs.readFileSync(path.join(ROOT, "theme/upstream/fonts", file)).toString("base64");
    return `url("data:font/woff2;base64,${data}")`;
  });
}

function build() {
  const upstream = read("theme/upstream/styles.css");
  const light = tokens(upstream, /\/\* Tome:[\s\S]*?:root \{([\s\S]*?)\n\}/, "Tome");
  const dark = tokens(upstream, /:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/, "Dungeon");
  return [
    "/* Generated by scripts/build-theme.js from theme/. Don't edit: change theme/theme.src.css and run npm run build:theme. */",
    `.theme-light {${light}\n}`,
    `.theme-dark {${dark}\n}`,
    inlineFonts(read("theme/theme.src.css")),
    iconCss(icons(read("theme/upstream/icons.js"))),
    "",
  ].join("\n");
}

module.exports = { build, tokens, icons };

if (require.main === module) {
  const css = build();
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== css) {
      console.error("theme.css is out of date: run npm run build:theme");
      process.exit(1);
    }
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, css);
  }
}
```

- [ ] **Step 4: Write `theme/theme.src.css`**

```css
/* Lorekeeper for Obsidian: Tome (light) and Dungeon (dark). The --lk-* tokens come first in theme.css, generated from
   Lorekeeper's own styles; this maps them onto Obsidian and styles the vault's own views. */

@font-face { font-family: "Bookinsanity"; src: url("fonts/bookinsanity-regular.woff2") format("woff2"); font-display: swap; }
@font-face { font-family: "Bookinsanity"; src: url("fonts/bookinsanity-italic.woff2") format("woff2"); font-style: italic; font-display: swap; }
@font-face { font-family: "Bookinsanity"; src: url("fonts/bookinsanity-bold.woff2") format("woff2"); font-weight: 700; font-display: swap; }
@font-face { font-family: "Bookinsanity"; src: url("fonts/bookinsanity-bold-italic.woff2") format("woff2"); font-weight: 700; font-style: italic; font-display: swap; }
@font-face { font-family: "Mr Eaves Small Caps"; src: url("fonts/mr-eaves-small-caps.woff2") format("woff2"); font-display: swap; }
@font-face { font-family: "Scaly Sans"; src: url("fonts/scaly-sans-regular.woff2") format("woff2"); font-display: swap; }
@font-face { font-family: "Scaly Sans"; src: url("fonts/scaly-sans-italic.woff2") format("woff2"); font-style: italic; font-display: swap; }
@font-face { font-family: "Scaly Sans"; src: url("fonts/scaly-sans-bold.woff2") format("woff2"); font-weight: 700; font-display: swap; }
@font-face { font-family: "Solbera Imitation"; src: url("fonts/solbera-imitation.woff2") format("woff2"); font-display: swap; }

body {
  font-synthesis: none;
  --lk-font-display: "Mr Eaves Small Caps", "Iowan Old Style", Georgia, serif;
  --font-text-theme: "Bookinsanity", "Bookman Old Style", "Iowan Old Style", Georgia, serif;
  --font-interface-theme: "Scaly Sans", -apple-system, "Segoe UI", system-ui, sans-serif;
  --h1-font: var(--lk-font-display); --h2-font: var(--lk-font-display); --h3-font: var(--lk-font-display);
  --h4-font: var(--lk-font-display); --h5-font: var(--lk-font-display); --h6-font: var(--lk-font-display);
  --inline-title-font: var(--lk-font-display);

  --background-primary: var(--lk-bg);
  --background-primary-alt: var(--lk-panel);
  --background-secondary: var(--lk-panel);
  --background-secondary-alt: var(--lk-hover);
  --background-modifier-border: var(--lk-line);
  --background-modifier-hover: var(--lk-hover);
  --background-modifier-form-field: var(--lk-panel);
  --text-normal: var(--lk-fg);
  --text-muted: var(--lk-muted);
  --text-faint: var(--lk-muted);
  --text-accent: var(--lk-accent-text);
  --text-accent-hover: var(--lk-accent);
  --text-on-accent: var(--lk-on-accent);
  --text-selection: var(--lk-accent-soft);
  --link-color: var(--lk-link);
  --link-color-hover: var(--lk-accent);
  --link-external-color: var(--lk-link);
  --link-unresolved-color: var(--lk-muted);
  --interactive-accent: var(--lk-accent);
  --interactive-accent-hover: var(--lk-seal-hi);
  --hr-color: var(--lk-rule);
  --blockquote-border-color: var(--lk-rule);
  --h1-color: var(--lk-accent-text); --h2-color: var(--lk-accent-text); --h3-color: var(--lk-accent-text);
  --inline-title-color: var(--lk-fg);
}

/* The page: aged parchment (Tome) or torchlit stone (Dungeon). */
.workspace-leaf-content[data-type="markdown"] .view-content,
.workspace-leaf-content[data-type="bases"] .view-content { background: var(--lk-surface-page); }

/* The leather sidebar, with a stitched seam. */
.workspace-split.mod-left-split, .workspace-ribbon.mod-left {
  background: var(--lk-surface-side);
  --background-secondary: transparent;
  --background-primary: transparent;
  --text-normal: var(--lk-side-fg);
  --text-muted: var(--lk-side-muted);
  --icon-color: var(--lk-side-muted);
  --icon-color-hover: var(--lk-side-fg);
  --nav-item-color: var(--lk-side-fg);
  --nav-item-color-hover: var(--lk-side-fg);
  --nav-item-background-hover: var(--lk-side-hover);
  --nav-item-color-active: var(--lk-selected-text);
  --nav-item-background-active: var(--lk-selected);
  --background-modifier-border: var(--lk-side-line);
  --background-modifier-hover: var(--lk-side-hover);
  color: var(--lk-side-fg);
}
.workspace-split.mod-left-split { border-right: 1px dashed var(--lk-stitch); }
.mod-left-split :is(.workspace-tab-header-container, .workspace-leaf-content, .nav-header, .view-header) { background: transparent; }

/* The vault's machinery stays out of sight. */
.nav-folder:has(> .nav-folder-title[data-path="_lorekeeper"]) { display: none; }

/* Kind icons on the campaign folders (the masks are generated after this file). */
.nav-folder-title[data-path] .nav-folder-title-content::before {
  display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px;
  background: currentColor; -webkit-mask: none center / contain no-repeat; mask: none center / contain no-repeat;
}
.nav-folder-title:not([data-path="PCs"], [data-path="NPCs"], [data-path="Locations"], [data-path="Items"], [data-path="Factions"], [data-path="Quests"], [data-path="Lore"], [data-path="Sessions"]) .nav-folder-title-content::before { display: none; }

/* Drop cap on every page title, as on Lorekeeper's session titles. */
.inline-title::first-letter { font-family: "Solbera Imitation", var(--lk-font-display); color: var(--lk-initial); }

/* Ornamental divider: a fleuron between two rules. */
.markdown-rendered hr, .markdown-source-view .hr hr {
  border: 0; height: 14px; margin: 1.5em 0;
  background:
    var(--lk-fleuron) center / 44px 14px no-repeat,
    linear-gradient(var(--lk-rule), var(--lk-rule)) left center / calc(50% - 30px) 1px no-repeat,
    linear-gradient(var(--lk-rule), var(--lk-rule)) right center / calc(50% - 30px) 1px no-repeat;
}

/* Wax-seal buttons. */
button.mod-cta {
  background: radial-gradient(ellipse 120% 150% at 35% 15%, var(--lk-seal-hi), var(--lk-seal) 55%, var(--lk-seal-lo));
  color: var(--lk-seal-text); border: 1px solid var(--lk-seal-edge); font-family: var(--lk-font-display);
}

/* The session view. */
.lk-session-view { margin-bottom: 1.5em; }
.lk-session-title { font-family: var(--lk-font-display); font-size: 1.4em; color: var(--lk-accent-text); margin-bottom: 0.4em; }
.lk-rubric { font-family: var(--lk-font-display); color: var(--lk-accent-text); font-size: 1.15em; margin: 0.8em 0 0.3em; }
.lk-open-quests { border: 1px solid var(--lk-line); background: var(--lk-surface-panel); border-radius: 4px; padding: 0.4em 0.9em 0.7em; }
.lk-quest p, .lk-note p { margin: 0; }
.lk-tabs { display: flex; gap: 6px; margin: 1em 0 0.6em; }
.lk-tabs button { font-family: var(--lk-font-display); background: transparent; border: 1px solid var(--lk-control-border); color: var(--lk-fg); box-shadow: none; }
.lk-tabs button.is-active { background: var(--lk-selected); color: var(--lk-selected-text); }
.lk-timeline[hidden], .lk-journal[hidden] { display: none; }
.lk-note { border-left: 3px solid var(--k, var(--lk-rule)); padding: 2px 0 2px 10px; margin: 3px 0; }
.lk-rubric.lk-kind-npc, .lk-rubric.lk-kind-loot, .lk-rubric.lk-kind-quest, .lk-rubric.lk-kind-mystery, .lk-rubric.lk-kind-quote { color: var(--k); }
.lk-kind-event { --k: var(--lk-rule); }
.lk-kind-npc { --k: var(--lk-kind-npc); }
.lk-kind-loot { --k: var(--lk-kind-loot); }
.lk-kind-quest { --k: var(--lk-kind-quest); }
.lk-kind-mystery { --k: var(--lk-kind-mystery); }
.lk-kind-quote { --k: var(--lk-kind-quote); font-style: italic; }
.lk-time { font-family: var(--font-interface-theme); font-variant-numeric: tabular-nums; color: var(--lk-muted); font-size: 0.85em; margin-right: 0.3em; }
.lk-author { font-family: var(--font-interface-theme); color: var(--lk-muted); font-size: 0.85em; }
.lk-author::before { content: "· "; }
.lk-empty { color: var(--lk-muted); font-style: italic; }

/* Coins in quest rewards. */
.lk-coin::before { content: ""; display: inline-block; width: 0.75em; height: 0.75em; margin-right: 0.2em; border-radius: 50%; vertical-align: -0.05em; background: var(--c); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.25); }
.lk-coin-pp { --c: #dfe3e8; }
.lk-coin-gp { --c: #d4a531; }
.lk-coin-ep { --c: #c2bb98; }
.lk-coin-sp { --c: #b8bec4; }
.lk-coin-cp { --c: #b06b3a; }
```

- [ ] **Step 5: Write `.obsidian/themes/Lorekeeper/manifest.json`, then build**

```json
{ "name": "Lorekeeper", "version": "1.0.0", "minAppVersion": "1.10.0", "author": "Yonatan Karp-Rudin", "authorUrl": "https://yonatankarp.com/lorekeeper/" }
```

Run: `npm run build:theme && npm test`
Expected: `# fail 0`, and `theme.css` is about 300 KB (`ls -lh .obsidian/themes/Lorekeeper/theme.css`)

- [ ] **Step 6: Compare with Lorekeeper (manual)**

Open the vault from Task 7's demo (or the repo vault) next to `~/Projects/_private_projects/lorekeeper/docs/screenshots/light.jpg` and `dark.jpg`. **Settings > Appearance**: switch **Base color scheme** between Light and Dark. Check:
1. The parchment page background and the leather sidebar with its dashed seam (Light); stone and gold (Dark).
2. Headings in Mr Eaves, text in Bookinsanity, the sidebar in Scaly Sans, and a red (Light) or gold (Dark) drop cap on page titles.
3. Kind icons on the campaign folders, and no `_lorekeeper` folder in the sidebar.
4. A `---` line in Reading view shows the fleuron.
5. On the session page, Timeline notes have their kind colours, and the coin on a reward shows.
If base64 fonts don't load (text falls back to Georgia), report it, per the spec's Risks.

- [ ] **Step 7: Commit**

```bash
git add theme scripts/build-theme.js .obsidian/themes test/theme.test.js
git commit -m "feat(Theme): Tome and Dungeon from Lorekeeper's colours, fonts and icons

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Hotkeys outside Obsidian: macOS, Windows and Linux

**Files:**
- Create: `_lorekeeper/capture/windows/lorekeeper.ahk`
- Create: `docs/CAPTURE.md`
- Modify: `docs/superpowers/specs/2026-10-10-lorekeeper-obsidian-design.md` (macOS Shortcuts: steps in `docs/CAPTURE.md` rather than files in the repo, since an exported Shortcut holds its author's vault path)

**Interfaces:**
- Consumes: `lk-note` (Task 4) with `--dialog`, `--stdin`, `--next` and `--here`, and exit code 3.

- [ ] **Step 1: Write `_lorekeeper/capture/windows/lorekeeper.ahk`**

```ahk
; Lorekeeper quick notes for Windows (AutoHotkey v2). UNTESTED. Needs Git for Windows, for sh.exe.
; Set VAULT to your vault's folder, then run this file (put a shortcut to it in shell:startup to start it at login).
#Requires AutoHotkey v2.0
VAULT := A_MyDocuments "\Lorekeeper"
SH := "C:\Program Files\Git\bin\sh.exe"

^!n:: {  ; Ctrl+Alt+N: the note box
    box := InputBox("Note", "Lorekeeper")
    if (box.Result = "OK" && Trim(box.Value) != "")
        Save(box.Value)
}

^+s:: {  ; Ctrl+Shift+S: save the selected text, or the clipboard if nothing is selected
    saved := ClipboardAll()
    A_Clipboard := ""
    Send "^c"
    text := ClipWait(0.5) ? A_Clipboard : ""
    A_Clipboard := saved
    if (Trim(text) = "")
        text := A_Clipboard
    if (Trim(text) != "")
        Save(text)
}

Save(text, flag := "") {
    tmp := A_Temp "\lorekeeper-note.txt"
    try FileDelete(tmp)
    FileAppend(text, tmp, "UTF-8-RAW")
    script := VAULT "\_lorekeeper\capture\lk-note"
    cmd := Format('"{1}" -c "exec sh \"$0\" --vault \"$1\" {2} --stdin < \"$2\"" "{3}" "{4}" "{5}"', SH, flag, script, VAULT, tmp)
    code := RunWait(cmd, , "Hide")
    if (code = 3) {
        answer := MsgBox("This session went quiet over 12 hours ago. Start the next session?", "Lorekeeper", "YesNo")
        Save(text, answer = "Yes" ? "--next" : "--here")
    } else if (code != 0) {
        MsgBox("Lorekeeper couldn't save the note (code " code "). Check VAULT and SH at the top of lorekeeper.ahk.", "Lorekeeper")
    }
}
```

- [ ] **Step 2: Write `docs/CAPTURE.md`**

````markdown
# Notes from anywhere

`_lorekeeper/capture/lk-note` saves a note to the current session without opening Obsidian, the way Lorekeeper's note box does. These steps bind it to Lorekeeper's hotkeys.

## macOS

Allow scripts once: open **Shortcuts**, then **Settings > Advanced** and turn on **Allow Running Scripts**. Replace `/path/to/vault` below with your vault's folder (drag the folder into the script box to paste its path).

**Note box (`⌘⌥N`):**
1. In Shortcuts, **File > New Shortcut**, and name it **Lorekeeper Note**.
2. Add **Run Shell Script**: Shell **zsh**, Pass Input **to stdin**, with the script:
   ```sh
   sh "/path/to/vault/_lorekeeper/capture/lk-note" --dialog
   ```
3. In the shortcut's **Details** (the ⓘ), **Add Keyboard Shortcut** and press `⌘⌥N`.

**Save selection (`⌘⇧S`):**
1. **File > New Shortcut**, named **Lorekeeper Save Selection**. In **Details**, turn on **Use as Quick Action** and **Services Menu**, receiving **Text** from **Any app**. If there's no input: **Get Clipboard**.
2. Add **Run Shell Script**: Shell **zsh**, Pass Input **to stdin**, with the script:
   ```sh
   sh "/path/to/vault/_lorekeeper/capture/lk-note" --stdin
   ```
3. **Add Keyboard Shortcut** and press `⌘⇧S`. In apps with a **Save As…** on `⌘⇧S`, the app's own shortcut wins; pick another key if that gets in the way.

The first time, macOS asks to let Shortcuts control **System Events**: allow it, since the note box is a System Events dialog.

**New session without opening Obsidian (optional):** a third shortcut running `sh "/path/to/vault/_lorekeeper/capture/lk-note" --next`.

## Windows (untested)

Install [AutoHotkey v2](https://www.autohotkey.com) and [Git for Windows](https://git-scm.com/download/win). Open `_lorekeeper/capture/windows/lorekeeper.ahk` in a text editor, set `VAULT` to your vault's folder, save it and double-click it. `Ctrl+Alt+N` opens the note box and `Ctrl+Shift+S` saves the selection.

## Linux (untested)

Install `zenity` (and `xclip` for saving the selection on X11). In your desktop's keyboard settings, add:
- `Ctrl+Alt+N`: `sh /path/to/vault/_lorekeeper/capture/lk-note --dialog`
- `Ctrl+Shift+S`: `sh -c 'xclip -o -selection primary | sh /path/to/vault/_lorekeeper/capture/lk-note --stdin'`

## What lk-note does

`lk-note [--vault DIR] [--next | --here] [--dialog | --stdin | TEXT…]` appends `- HH:MM text` to the newest `Sessions/Session N.md`, starting Session 1 if there's none. When the session hasn't changed in 12 hours, it asks **Start Session N+1?**, or exits with code 3 when it can't ask: run it again with `--next` to start the next session or `--here` to keep the current one.
````

- [ ] **Step 3: Update the spec's macOS line**

In `docs/superpowers/specs/2026-10-10-lorekeeper-obsidian-design.md`, replace `- **macOS:** two Shortcuts in the repo.` with `- **macOS:** two Shortcuts, built from the steps in \`docs/CAPTURE.md\` (an exported Shortcut would hold its author's vault path).`

- [ ] **Step 4: Check it on macOS (manual)**, following `docs/CAPTURE.md` with the repo vault:
1. In Discord's message box, press `⌘⌥N`, type `!Find the missing miners` and press Enter. Discord keeps focus, and the note is the last line of the newest session.
2. Select a sentence in Safari and press `⌘⇧S`. The sentence is saved as one line.
3. With nothing selected, `⌘⇧S` saves the clipboard.

- [ ] **Step 5: Commit**

```bash
git add _lorekeeper/capture/windows docs/CAPTURE.md docs/superpowers/specs/2026-10-10-lorekeeper-obsidian-design.md
git commit -m "feat(Capture): hotkeys for notes from anywhere on macOS, Windows and Linux

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: README, checklist and the end-to-end pass

**Files:**
- Modify: `README.md`
- Create: `docs/CHECKLIST.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# Lorekeeper for Obsidian

Session notes for D&D players, as an Obsidian vault: jot things down during the game without leaving Discord, read each session as a Timeline or a Journal, and keep a vault of NPCs, places and quests. One vault per campaign. It's [Lorekeeper](https://github.com/yonatankarp/lorekeeper)'s workflow and look, without the app.

## Start a campaign

1. On GitHub, **Use this template** (or clone it) and name the copy after your campaign.
2. In Obsidian, **Open folder as vault** and pick it. Choose **Trust author and enable plugins**: the vault uses QuickAdd, Templater, Dataview and Custom Selectors, already set up.
3. Open **Home** from the bookmarks.
4. For notes over Discord without opening Obsidian, set up the hotkeys in [docs/CAPTURE.md](docs/CAPTURE.md).

## During the game

Press `⌘⌥N` (`Ctrl+Alt+N`) and type `@Mirela, shifty innkeeper`. Start a note with a symbol to file it: `@` NPCs, `#` loot, `!` quests, `?` mysteries, `"` quotes, nothing for what happened. Inside Obsidian the same hotkey opens a new line in the current session, with link suggestions.

## After the game

- Open a session (`⌘J` or `Ctrl+J` for the current one): open quests at the top, then its notes as a **Timeline** or a **Journal**, then the raw notes under **Notes**, where you edit them.
- **New page** (`⌘N` or `Ctrl+N`): pick NPC, PC, Location, Item, Faction, Quest, Lore or your own (any file you add to `Templates/`), and name it. Clicking a link to a page that doesn't exist yet asks the same.
- Quests have a **status** (open, in progress, done, failed). NPCs have a **condition** (alive, dead, missing, unknown) and an **attitude** (friendly, neutral, hostile, unknown).
- A session's `title` property names it: "The bridge collapse".
- **Home** lists open quests, recent sessions and NPCs. The graph (`⌘G`) maps the connections.
- Everything is in the **Cheat Sheet** (`⌘/` or `Ctrl+/`).

## Not here yet

Playing with your party, private notes, status marks in the sidebar and D&D Beyond import come later (see the roadmap in `docs/superpowers/specs/`). Back up with Obsidian Git or by keeping the vault in a cloud drive.

## Development

```bash
npm test                 # unit tests (Node 20+)
npm run build:theme      # rebuild .obsidian/themes/Lorekeeper/theme.css from theme/
scripts/update-plugins.sh  # download the plugin versions in plugin-versions.txt
```

Credits: [CREDITS.md](CREDITS.md). Licence: MIT, except the fonts and `theme.css` (CC BY-SA 4.0).
````

- [ ] **Step 2: Write `docs/CHECKLIST.md`**

```markdown
# Manual checklist

Run before tagging a release, in a fresh copy of the vault (`cp -R` the repo, without `.git`), opened in Obsidian.

- [ ] **Plugins:** all four turned on after **Trust author and enable plugins**.
- [ ] **Theme:** Light and Dark next to Lorekeeper's `docs/screenshots/light.jpg` and `dark.jpg`: parchment and leather sidebar, stone and gold, D&D fonts, the drop cap, folder icons, no `_lorekeeper` folder.
- [ ] **Capture over Discord (macOS):** `⌘⌥N` saves a note and Discord keeps focus; `⌘⇧S` saves a selection and, with nothing selected, the clipboard.
- [ ] **Quiet session:** `touch -t 202601010000` on the newest session, then `⌘⌥N` asks **Start Session N+1?** (outside Obsidian and inside).
- [ ] **Quick note in Obsidian:** `⌘⌥N` puts the cursor on a new `- HH:MM ` line, `[[` suggests pages, and closing it untyped leaves no empty note.
- [ ] **New page:** `⌘N` for each built-in kind lands in its folder with its template; a custom `Templates/Monster.md` shows up and goes to `Monsters/` if it exists; a taken name is refused.
- [ ] **Unresolved link:** clicking one asks **What is …?** and files the page.
- [ ] **Session page:** open quests with coins, Timeline in kind colours, Journal grouped, the toggle remembered.
- [ ] **Home:** open quests with a status dropdown, recent sessions with titles, NPCs grouped by attitude.
- [ ] **Rename:** `F2` on an NPC updates `@[[links]]` in sessions.
- [ ] **Mobile (if you sync the vault):** a session page renders its view.
```

- [ ] **Step 3: Run the full suite and shellcheck**

Run: `npm test && npm run check:theme && shellcheck _lorekeeper/capture/lk-note scripts/update-plugins.sh`
Expected: `# fail 0`, no output from the other two

- [ ] **Step 4: Work through `docs/CHECKLIST.md` once**, ticking it in a scratch copy (not in the repo). Report any item that fails, with what happened.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/CHECKLIST.md
git commit -m "docs: README and the manual checklist

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
