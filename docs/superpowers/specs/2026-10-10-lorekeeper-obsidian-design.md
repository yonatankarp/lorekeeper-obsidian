# Lorekeeper for Obsidian: v1 design

Date: 2026-10-10. Status: draft for review.

## Goal

A vault you clone and open in Obsidian that gives one player Lorekeeper's workflow and look: quick notes from anywhere during the game, sessions read as a Timeline and a Journal, a campaign vault of NPCs, PCs, places, items, factions, quests and lore, and the Tome and Dungeon themes. No Lorekeeper app needed.

**The end goal is to replace Lorekeeper completely** with an Obsidian vault. v1 is the first milestone: one player, no sync. Nothing in v1 may block the later milestones (see Roadmap).

**Accepted losses** (decided 2026-10-10). Replacing Lorekeeper may give these up, so none of them justifies a plugin of our own:
- End-to-end encrypted sharing. A sync service that can read the notes (for example Relay) is acceptable.
- Party admin: roles, one-time invite links, re-invites, removing players, who's online.
- Timelines shown in each reader's own time zone. Times are the writer's local time.
- D&D Beyond refresh as Lorekeeper does it. The third-party importer (public characters only), or PCs typed by hand, is acceptable.

Success means: during a game you can jot `@Mirela, shifty innkeeper` over Discord without Discord losing focus, and after the game the vault reads and looks like Lorekeeper.

## Decisions

- **Delivery:** a GitHub template repo whose root is the vault, with `.obsidian/` checked in. Not a setup plugin: a plugin can't install the community plugins this relies on, and it would need weeks of directory review. A plugin can come later if people want this in existing vaults.
- **One vault is one campaign.** The vault root is the campaign folder. A second game is a second clone. Templates are per vault.
- **The same behaviour as Lorekeeper, not the same files.** The file format is ours to choose where Obsidian does better with a different one (a view block in each session, Templater syntax, typed properties). Lorekeeper opening the vault is not a goal.
- **Behaviour lives in files under `_lorekeeper/`,** one per job, so a plugin could take each over later without a rewrite.
- **Community plugins only, pinned and committed:** QuickAdd, Templater, Dataview and Custom Selectors, plus the core Bases plugin. No plugin of our own in v1.

## Layout

```
Sessions/  PCs/  NPCs/  Locations/  Items/  Factions/  Quests/  Lore/  Attachments/
Templates/            PC NPC Location Item Faction Quest Lore .md
Home.md               dashboard
Cheat Sheet.md
_lorekeeper/
  lib/                pure functions shared by the scripts (tested)
  templates/          session.md (the new-session file, used by both capture paths)
  lib/load.js         loads lib/ inside Obsidian (desktop and mobile), since Node's require can't see the vault
  scripts/            QuickAdd scripts (quick-note, new-session, open-session, new-page, open-cheat-sheet) and the session view
  scripts/templater/  Templater user scripts (none in v1; the folder must exist)
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

## Behaviour and files

The behaviour follows Lorekeeper's `docs/GUIDE.md`. The files are designed for Obsidian.

- **A session** is `Sessions/Session N.md`, made from `_lorekeeper/templates/session.md` with N and the date filled in:
  ~~~
  ---
  session: N
  date: YYYY-MM-DD
  cssclasses: [lk-session]
  ---
  ```dataviewjs
  await dv.view("_lorekeeper/scripts/session", { file: dv.current().file.path })
  ```

  ## Notes
  ~~~
  Opening a session shows its open quests, Timeline and Journal (see Views) above the raw notes. An optional `title` property names it ("Session 14 · The bridge collapse"). The file keeps its "Session N" name.
- **A note** is one line appended at the end of the file, `- HH:MM text`, with the text's whitespace collapsed to single spaces. An empty note writes nothing.
- **Kinds** come from the first character: `@` NPCs, `#` Loot, `!` Quests, `?` Mysteries, `"` Quotes, anything else What happened.
- **The current session** is the highest N, counting both `Session N.md` files and `Session N/` folders. With no session yet, the first note starts Session 1.
- **The next session:** when the last note in the current session is more than 12 hours old, capture offers to start the next one.
- **Per-author files** `Sessions/Session N/<PC>.md` (with an `author` property) are read by every view, so party play needs no migration. v1 never writes them.
- **Private notes** (party play, not in v1) will live in one folder per player, `Private/<PC>/`, mirroring the vault inside it (`Private/<PC>/Sessions/Session N.md`, `Private/<PC>/NPCs/…`). One folder per player is what folder-based sharing needs to show a player's private notes to the DM only. The views must not assume `Private/` is absent.
- **Pages** come from seven templates with the same properties and sections as Lorekeeper's (PC, NPC, Location, Item, Faction, Quest, Lore), written in Templater syntax. Dates are typed date properties. Typed by `type`. Quest `status`: open, in progress, done, failed. NPC `condition`: alive, dead, missing, unknown (not `status`: Custom Selectors sets options per property name across the vault, so quests and NPCs can't share one). NPC `attitude`: friendly, neutral, hostile, unknown. Empty means unknown. Pages have no `# title` heading, since Obsidian shows the file name as the title.
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

- `lk-note [--vault DIR] [--next | --here] [--dialog | --stdin | TEXT…]` finds the current session, or starts one from `_lorekeeper/templates/session.md`, and appends `- HH:MM text`. A session counts as quiet when its file hasn't changed in 12 hours, as in Lorekeeper. Then it exits 3 unless `--next` (start the next session) or `--here` (keep this one) says what to do.
- **One key everywhere (macOS):** with `--dialog`, when Obsidian is the frontmost app, `lk-note` runs **Quick note** inside Obsidian through `obsidian://quickadd` instead of showing the system box.
- `--dialog` asks for the note in the system's own box, and asks "Start Session N+1?" when the session is quiet: `osascript` on macOS, `zenity` on Linux. `--stdin` reads the note from standard input, for saving the selection, and asks about a quiet session the same way.
- **macOS:** two Shortcuts, built from the steps in `docs/CAPTURE.md` (an exported Shortcut would hold its author's vault path). **Lorekeeper Note** (`⌘⌥N`) runs `lk-note --dialog`. **Lorekeeper Save Selection** (`⌘⇧S`) is a Quick Action that passes the selected text to `lk-note --stdin`.
- **Windows:** an AutoHotkey v2 script that asks for the note and runs `lk-note` with Git for Windows' `sh`. **Linux:** the desktop's shortcut settings run `lk-note --dialog`. Both are untested in v1, and the README says so.

**Inside Obsidian.** The QuickAdd command **Lorekeeper: Quick note** (`⌘⌥N` inside Obsidian) runs `quick-note.js`. It opens the current session (offering the next one when it's quiet), adds a `- HH:MM ` line at the end and puts the cursor there, so Obsidian's own `[[` suggestions work while you type. **Lorekeeper: New session** starts the next session and opens it.

Not carried over in v1: `↑` to fix the last note, `[[` suggestions in the system input box, and `~` private notes (they are part of party play).

## New page

The QuickAdd command **Lorekeeper: New page** (`⌘N`) runs `new-page.js`:

1. Pick a kind. The list is the files in `Templates/`, so a custom `Templates/Monster.md` adds Monster.
2. Type a name. A name that's taken, or has `/ \ : * ? " < > |`, is refused.
3. The script asks Templater to create the page from the template in the kind's folder (a custom kind goes in `Monsters/` or `Monster/` if one exists, else the root) and opens it.

**Templater folder templates** map each folder to its template, so a page made any other way in `NPCs/` gets the NPC template too. **Clicking a link to a page that doesn't exist yet** creates an empty note at the root. Templater's on-create trigger runs the kind picker, which fills the note and moves it.

Taken from Obsidian as is: **Rename** updates every link (with **Automatically update internal links** on), undo, and the **Status** and **Attitude** dropdowns (Custom Selectors, set up with the values above).

## Views

**A session page** (`⌘J` opens the current one) shows, from top to bottom:
1. The open and in-progress quests.
2. **Timeline | Journal**, a toggle. **Timeline** is every note in time order with its time and kind colour, and notes from per-author files show their author. **Journal** is the notes grouped into What happened, NPCs, Loot, Quests, Mysteries and Quotes.
3. `## Notes`, the raw lines, where you edit.

`_lorekeeper/scripts/session.js` renders this through DataviewJS from `lib/notes.js`. Open quests show their reward with coin icons (`lib/coins.js`). The `lk-session` CSS class styles the page.

**`Home.md`:**
- Bases views of open and in-progress quests with their status, NPCs grouped by attitude, and recent sessions with their titles.
- A **Connections** link to the graph, saved with a filter that hides `Sessions/`.

**`Cheat Sheet.md`** (`⌘/`) lists the note symbols, links and hotkeys of this setup.

**Hotkeys:** `⌘K` search (replaces Obsidian's insert link), `⌘N` New page, `⌘⌥N` Quick note, `⌘J` current session, `⌘/` Cheat Sheet, with the `Ctrl` versions on Windows and Linux.

## Plugins

Pinned in `plugin-versions.txt`, with each plugin's `main.js`, `manifest.json`, `styles.css` and settings committed, so a fresh clone works after **Turn on community plugins**. `scripts/update-plugins.sh` downloads the listed versions from GitHub releases. Their licences are listed in `CREDITS.md`.

## Testing

- **Unit (`node --test`):** `_lorekeeper/lib/` covers prefix to kind, line parsing (skipping the view block and headings), merging per-author files, finding the current session, the 12-hour rule, the session file, kinds and folders, name checks, coin parsing and the loader. Lorekeeper's `notes.test.js` and `vault.test.js` are a source of cases for the behaviour.
- **Shell:** `lk-note` against the same fixtures in temp folders, plus `shellcheck`.
- **CI:** GitHub Actions runs both on every push.
- **Manual checklist in `docs/CHECKLIST.md`:**
  - the theme in light and dark against Lorekeeper's screenshots;
  - a quick note and a saved selection over Discord on macOS, with Discord keeping focus;
  - a new page from `⌘N` and from clicking an unresolved link;
  - Home and a session page on a demo campaign.

## Roadmap

Every feature in Lorekeeper's `docs/GUIDE.md`, the milestone that delivers it, and how. M1 is this spec. M2 finishes solo parity. M3 is party play.

| Lorekeeper feature | Milestone | In the vault |
|---|---|---|
| Note box hotkey, save selection, note symbols | M1 | system input box + `lk-note`, QuickAdd in Obsidian |
| Offer the next session after 12 hours | M1 | `lk-note` exit code, asked by the Shortcut |
| New session and New page hotkeys | M1 | QuickAdd commands; system hotkey for New session via `lk-note --next` |
| Timeline and Journal, open quests on sessions | M1 | view block in each session |
| New page by kind, custom templates, unresolved links | M1 | `new-page.js`, Templater folder templates and on-create trigger |
| Quest status, NPC status and attitude | M1 | properties with Custom Selectors |
| Home: open quests, NPCs, sessions, coin icons | M1 | Bases, `coins.js` |
| Live-preview editor, rename, move, backlinks, search, images | M1 | Obsidian itself |
| Session titles | M1 | `title` property, shown by the views and Bases |
| Connections map | M1 | graph view with a saved filter |
| Cheat sheet | M1 | `Cheat Sheet.md` |
| Tome and Dungeon themes, text size | M1 | the theme, Obsidian's font size setting |
| Several campaigns | M1 | one vault each, Obsidian's vault switcher |
| Status markers in the file list | M2 (done) | Supercharged Links |
| NPC attitude colours on Home | M2 (done) | CSS on Bases group headers if Obsidian exposes a hook, else the plugin decision |
| Kind colours on note lines while editing | M2 | a CSS snippet if Obsidian exposes the text, else an accepted loss or the plugin decision |
| `[[` suggestions and `↑` in the system note box | M2 | try a richer input (Raycast extension); else accepted loss |
| D&D Beyond import | M2 (done) | the third-party D&D Beyond Importer |
| Backups to a folder, Dropbox, Google Drive or GitHub | M2 (done) | Obsidian Git, or the vault in a cloud drive; documented in the README |
| Automatic updates | M2 (done) | `scripts/update-plugins.sh` and pulling the template repo; Obsidian updates itself |
| Sharing with the party, notes with their author | M3 | a shared vault (choose Relay or Obsidian Sync then), per-author capture into `Sessions/Session N/<PC>.md` |
| Private notes, `~` in the note box | M3 | `Private/<PC>/`, capture routes `~` notes there |
| Private notes visible to the DM | M3 | share `Private/<PC>/` with the DM (needs folder-level sharing, so Relay) |
| `~` lines in the editor moving to private notes | M3 | a QuickAdd command on the current line; moving on save is an accepted loss |
| Sync conflicts | M3 | none with Relay (live merging); Obsidian Sync merges |
| Roles, invites, online, time zones | none | accepted losses |

**Plugin decision point:** after M2, list what's still missing or clumsy. Write a Lorekeeper Kit plugin only if that list matters more than the cost of maintaining one.

## Risks

- Four community plugins can change under us. Versions are pinned, and every Obsidian-specific behaviour is a thin wrapper over the tested `lib/`.
- Obsidian may not load base64 fonts at this size. Fallback: the font stacks Lorekeeper already lists.
- Templater's on-create trigger on a link-created note, and `osascript`'s dialog handing focus back to Discord, are assumptions. The plan checks both early.
- Custom Selectors is a small plugin (MIT, a handful of stars) that edits Obsidian's DOM. If it breaks, plain text properties still work.
