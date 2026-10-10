# Lorekeeper for Obsidian: v1 design

Date: 2026-10-10. Status: draft for review.

## Goal

A vault you clone and open in Obsidian that gives one player Lorekeeper's workflow and look: quick notes from anywhere during the game, sessions read as a Timeline and a Journal, a campaign vault of NPCs, PCs, places, items, factions, quests and lore, and the Tome and Dungeon themes. No Lorekeeper app needed.

v1 is solo. Party play comes later, so nothing in v1 may block it.

Success means: during a game you can jot `@Mirela, shifty innkeeper` over Discord without Discord losing focus, and after the game the vault reads and looks like Lorekeeper.

## Decisions

- **Delivery:** a GitHub template repo whose root is the vault, with `.obsidian/` checked in. Not a setup plugin: a plugin can't install the community plugins this relies on, and it would need weeks of directory review. A plugin can come later if people want this in existing vaults.
- **One vault is one campaign.** The vault root is the campaign folder. A second game is a second clone. Templates are per vault.
- **File-compatible with Lorekeeper.** The vault writes exactly Lorekeeper's format, so Lorekeeper can open it with **Choose existing folder…** and either app can be used on the same campaign.
- **Behaviour lives in files under `_lorekeeper/`,** one per job, so a plugin could take each over later without a rewrite.
- **Community plugins only, pinned and committed:** QuickAdd, Templater, Dataview and Custom Selectors, plus the core Bases plugin. No plugin of our own in v1.

## Layout

```
Sessions/  PCs/  NPCs/  Locations/  Items/  Factions/  Quests/  Lore/  Attachments/
Templates/            PC NPC Location Item Faction Quest Lore .md
Home.md               dashboard
Session.md            Timeline and Journal of one session
Cheat Sheet.md
_lorekeeper/
  lib/                pure functions shared by the scripts (tested)
  scripts/            capture.js  new-page.js  timeline.js  journal.js  coins.js
  bases/              quests.base  npcs.base  sessions.base
  capture/            lk-note (POSIX sh), macOS Shortcuts, Windows AutoHotkey, Linux notes
.obsidian/
  themes/Lorekeeper/  theme.css  manifest.json
  plugins/            quickadd  templater-obsidian  dataview  custom-selectors
  app.json  appearance.json  hotkeys.json  graph.json  core-plugins.json  community-plugins.json
scripts/update-plugins.sh   plugin-versions.txt
test/                 node --test suites, shell tests, fixtures
README.md  CREDITS.md  LICENSE
```

## The format (compatibility contract)

Taken from Lorekeeper's `src-tauri/src/lib.rs` and `docs/GUIDE.md`. Any change in Lorekeeper's format is a bug here.

- **A session** is `Sessions/Session N.md`. A new one starts with:
  ```
  ---
  session: N
  date: YYYY-MM-DD
  utc-offset: +HH:MM
  ---
  # Session N - YYYY-MM-DD

  ```
  An optional `title` property names it ("Session 14 · The bridge collapse"). The file keeps its "Session N" name.
- **A note** is one appended line, `- HH:MM text`, with the text's whitespace collapsed to single spaces. An empty note writes nothing.
- **Kinds** come from the first character: `@` NPCs, `#` Loot, `!` Quests, `?` Mysteries, `"` Quotes, anything else What happened.
- **The current session** is the highest N, counting both `Session N.md` files and `Session N/` folders. With no session yet, the first note starts Session 1.
- **The next session:** when the last note in the current session is more than 12 hours old, capture offers to start the next one.
- **Per-author files** `Sessions/Session N/<PC>.md` (with an `author` property) are read by every view, so party play needs no migration. v1 never writes them.
- **Pages** use the seven templates copied byte for byte from Lorekeeper, with `{{title}}` and `{{date}}` (YYYY-MM-DD). Typed by `type`. Quest `status`: open, in progress, done, failed. NPC `status`: alive, dead, missing, unknown. NPC `attitude`: friendly, neutral, hostile, unknown. Empty means unknown.
- **Images** go in `Attachments/` and embed as `![[name.png]]`, with an optional `|300` width.

## Theme

One theme, `Lorekeeper`: Tome under `.theme-light`, Dungeon under `.theme-dark`. Obsidian's **Adapt to system** setting stands in for Lorekeeper's **Match my computer**. The colour tokens are copied from Lorekeeper's `src/styles.css` and mapped to Obsidian variables:

| Lorekeeper | Obsidian |
|---|---|
| `--surface-page`, `--bg` | note pane background, `--background-primary` |
| `--fg`, `--muted`, `--line`, `--link`, `--accent` | `--text-normal`, `--text-muted`, `--background-modifier-border`, `--link-color`, `--interactive-accent` |
| `--font-body`, `--font-display`, `--font-ui` | `--font-text-theme`, heading fonts, `--font-interface-theme` |
| leather sidebar, `--side-*`, `--stitch` seam | `.mod-left-split` and the ribbon |
| drop cap, `--font-initial`, `--initial` | `.inline-title::first-letter` |
| fleuron | `hr` |
| wax seal, `--seal-*` | `.mod-cta` buttons |
| kind icons from `src/icons.js` | `.nav-folder-title[data-path="…"]::before`, as an SVG mask |
| `--kind-*` | classes the Timeline and Journal emit |

The nine Solbera woff2 fonts are inlined in `theme.css` as base64 (about 230 KB), credited in `CREDITS.md` under CC BY-SA 4.0 as in Lorekeeper's `src/fonts/README.md`.

Obsidian's own layout (tabs, ribbon, status bar) stays. The target is the same book look, checked side by side with Lorekeeper's `docs/screenshots/light.jpg` and `dark.jpg`, not a pixel copy.

## Capture

**From outside Obsidian (the hotkeys).** The system shows its own input box and `_lorekeeper/capture/lk-note` appends the line to the file. Obsidian never takes focus, and it works with Obsidian closed.

- `lk-note [--vault DIR] [--next] TEXT` follows the contract: it finds or starts the current session and appends `- HH:MM text`. When the last note is over 12 hours old it exits with a distinct code, so the caller can ask "Start Session N+1?" and rerun it with `--next`.
- **macOS:** two Shortcuts in the repo. **Lorekeeper Note** (`⌘⌥N`) asks for the text. **Lorekeeper Save Selection** (`⌘⇧S`) is a Quick Action that takes the selected text, or the clipboard when there's none.
- **Windows:** an AutoHotkey v2 script. **Linux:** `zenity` plus the desktop's shortcut settings. Both are untested in v1, and the README says so.

**Inside Obsidian.** The QuickAdd command **Lorekeeper: Quick note** (`⌘⌥N` inside Obsidian) runs `capture.js` with the same rules and the same fixtures. It offers `[[` link suggestions if QuickAdd's prompt supports them.

Not carried over in v1: `↑` to fix the last note, `[[` suggestions in the system input box, and `~` private notes (they are part of party play).

## New page

The QuickAdd command **Lorekeeper: New page** (`⌘N`) runs `new-page.js`:

1. Pick a kind. The list is the files in `Templates/`, so a custom `Templates/Monster.md` adds Monster.
2. Type a name. A name that's taken, or has `/ \ : * ? " < > |`, is refused.
3. The script fills in `{{title}}` and `{{date}}` and writes the page into the kind's folder. A custom kind goes in `Monsters/` or `Monster/` if one exists, else the root.

**Clicking a link to a page that doesn't exist yet:** Obsidian creates an empty note at the root. Templater's on-create trigger runs the same kind picker, which fills the note and moves it. This trigger is Templater's only job.

Taken from Obsidian as is: **Rename** updates every link (with **Automatically update internal links** on), undo, and the **Status** and **Attitude** dropdowns (Custom Selectors, set up with the values above).

## Views

**`Session.md`** (`⌘J`) shows the session named in its `session` property, else the latest. From top to bottom:
1. The open and in-progress quests.
2. **Timeline:** every note in time order with its time and kind colour. Notes from per-author files show their author.
3. **Journal:** the notes grouped into What happened, NPCs, Loot, Quests, Mysteries and Quotes.

It's DataviewJS calling `timeline.js` and `journal.js`. Session files themselves stay plain Markdown and show their raw lines.

**`Home.md`:**
- Bases views of open and in-progress quests with their status, NPCs grouped by attitude in their colours, and recent sessions with their titles.
- Quest rewards like `25gp` with coin icons (`coins.js`).
- A **Connections** link to the graph, saved with a filter that hides `Sessions/`.

**`Cheat Sheet.md`** (`⌘/`) lists the note symbols, links and hotkeys of this setup.

**Hotkeys:** `⌘K` search (replaces Obsidian's insert link), `⌘N` New page, `⌘⌥N` Quick note, `⌘J` Session, `⌘/` Cheat Sheet, with the `Ctrl` versions on Windows and Linux.

## Plugins

Pinned in `plugin-versions.txt`, with each plugin's `main.js`, `manifest.json`, `styles.css` and settings committed, so a fresh clone works after **Turn on community plugins**. `scripts/update-plugins.sh` downloads the listed versions from GitHub releases. Their licences are listed in `CREDITS.md`.

## Testing

- **Unit (`node --test`):** `_lorekeeper/lib/` covers prefix to kind, line parsing, finding the current session, the 12-hour rule, the session header, template filling, name checks and coin parsing. Cases are taken from Lorekeeper's `notes.test.js` and `vault.test.js`.
- **Shell:** `lk-note` against the same fixtures in temp folders, plus `shellcheck`.
- **CI:** GitHub Actions runs both on every push.
- **Manual checklist in `docs/CHECKLIST.md`:**
  - the theme in light and dark against Lorekeeper's screenshots;
  - the vault opened in Lorekeeper with **Choose existing folder…** showing every session and page;
  - a quick note and a saved selection over Discord on macOS, with Discord keeping focus;
  - a new page from `⌘N` and from clicking an unresolved link;
  - Home and Session on a demo campaign.

## Out of scope for v1 (the v2 list)

- Status markers in the file list (hostile NPCs red, dead ones crossed out, done quests ticked): Supercharged Links or a Lorekeeper Kit plugin.
- Kind colours and the Timeline in the session file itself: a plugin's Markdown post-processor.
- Coin icons in properties.
- `[[` suggestions and `↑` in the system input box.
- Party play: a shared vault (Obsidian Sync, or Relay for DM-only notes), per-author capture, `~` private notes, time zones.
- D&D Beyond import.
- Backups: Obsidian Git or a cloud drive, set up by the user.

## Risks

- Four community plugins can change under us. Versions are pinned, and every Obsidian-specific behaviour is a thin wrapper over the tested `lib/`.
- Obsidian may not load base64 fonts at this size. Fallback: the font stacks Lorekeeper already lists.
- Templater's on-create trigger and QuickAdd's link suggestions are assumptions. Check both first in the plan, and drop or replace either if it doesn't work.
