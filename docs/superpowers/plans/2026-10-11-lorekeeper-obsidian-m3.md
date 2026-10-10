# Lorekeeper for Obsidian, M3 Implementation Plan (party play)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sync-agnostic party play: who-am-I per device, per-player session files, `~` private notes and private pages, a DM without a character, and setup docs for Relay and Obsidian Sync.

**Architecture:** As in M1/M2: pure CommonJS in `_lorekeeper/lib/` (no `require`, loaded by `load.js`), Obsidian glue in `lib/` taking `app`/`obsidian` as arguments and tested with fake apps, thin QuickAdd scripts, POSIX `lk-note`, theme from `theme/theme.src.css`.

**Spec:** `docs/superpowers/specs/2026-10-11-lorekeeper-obsidian-m3-design.md` (M1 and M2 specs still bind).

**USER CHECKPOINTs** (hands-on in Obsidian) are collected for the user at the end. Task 8 (release) stops for the user's go-ahead before pushing.

## Global Constraints

- Repo `~/Projects/_private_projects/lorekeeper-obsidian`, published as public `yonatankarp/lorekeeper-obsidian`. Work on branch `m3` from `main`. Never push except in Task 8 after the user says yes. Commit author address is `yonvata@gmail.com` (repo config already set).
- Release `v0.3.0`; `package.json` version becomes `0.3.0` in Task 7.
- lib modules are CommonJS with no `require`; add each new one to `MODULES` in `_lorekeeper/lib/load.js` (and a load.test assertion). Entry scripts keep the three boot lines verbatim.
- `make-manifest.js` reads the git index: stage, `npm run make:manifest`, `git add lorekeeper.json` before committing whenever a categorised file changed.
- To change the committed `.obsidian/plugins/quickadd/data.json` or `.obsidian/hotkeys.json` without touching a possibly-modified working copy: edit a copy of `git show HEAD:<path>` outside the repo and `git update-index --add --cacheinfo 100644,$(git hash-object -w <copy>),<path>`; if the working copy is clean, editing it directly is fine.
- Identity: localStorage key `lorekeeper-me`; desktop file `~/.config/lorekeeper/me.tsv`, lines `<absolute vault path>\t<name>`; `<name>` is a PC page name or `DM`; empty/absent = solo.
- Per-player session file: `Sessions/Session N/<name>.md`; private session file: `Private/<name>/Sessions/Session N.md`; private pages: `Private/<name>/<path>`.
- Party mode = a name is picked. Solo mode must behave exactly as v0.2.0 (all existing tests stay green unchanged).
- Copy: plain words, **bold** labels in docs, both `⌘`/`Ctrl`, no em dashes. Commit subjects `kind(Area): what changed`, harness trailer.

## Review Focus

1. **Solo vaults don't change.** With no name picked, every capture path writes `Sessions/Session N.md` exactly as before (existing tests unchanged).
2. **A private note never lands in a shared file.** Every `~` path and Make line private writes only under `Private/<name>/`; Make line private removes the lines from the shared page only after the private write succeeded.
3. **Other players' private notes are never shown to a non-DM**, even when their folders are present (misconfigured sync), and the warning appears.
4. **Two players starting the same session** get one `Session N.md` view page and two part files, never `Session N+1` twice (join rule).
5. **`lk-note` reads only an exact vault-path match** in `me.tsv` (a vault inside another's path, or a path with spaces, must not pick up the wrong name).

---

### Task 1: Party rules (pure)

**Files:** Create `_lorekeeper/lib/party.js`, `_lorekeeper/templates/session-part.md`; modify `_lorekeeper/lib/load.js`; test `test/party.test.js`.

**Interfaces (produces):**
- `DM = "DM"`
- `meFromTsv(text, vaultPath): string` — the name on the line whose first field equals `vaultPath` exactly, else `""`.
- `tsvWith(text, vaultPath, name): string` — the file with that vault's line replaced, added, or removed (`name` empty); other lines kept; ends with a newline when non-empty.
- `partPath(n, name) = "Sessions/Session N/<name>.md"`; `privateSessionPath(n, name) = "Private/<name>/Sessions/Session N.md"`; `privatePath(path, name) = "Private/<name>/<path>"`; `sharedPath(path)` strips a leading `Private/<x>/`; `privateOwner(path)` → `<x>` or `""`.
- `privateNote(text): { private: boolean, text }` — a leading `~` (after optional spaces) marks private and is removed (Lorekeeper `privateNote`).
- `canPick(name)`: false for `DM` as a PC page name.
- `joinOrNext({ n, mine, others, nowMs })` → `n` or `n+1` for **New session**: join `n` when `mine` is false (you have no part file in it) and any `others` mtime is within 12 hours of `nowMs`; else `n + 1` (Lorekeeper `new_session`). `others` = mtimes of other files in `Sessions/Session N/` plus `Session N.md`.
- `quietParty({ mineMtime, othersMtimes, nowMs })` → true when your own file is older than 12 h, or you have none and every other file is older than 12 h (or there are none).
- `takeLines(md, from, to)` → `{ rest, lines }`: removes lines `from..to` (inclusive, 0-based) and returns them.
- `privatizeLines(lines, page)` → lines with a leading `~` (after an optional `- ` and `HH:MM `) dropped, and, when `page` is given (`{ name, kind }`, a non-session page), a link prepended to lines that don't already link it: `@[[Name]] ` for kind `npc`, `[[Name]] ` otherwise, placed after `- HH:MM ` when present.
- `visiblePrivate({ me, isDM, paths })` → `{ show: string[], foreign: string[] }`: from the private session files in `paths`, `show` your own (and, when `isDM`, everyone's); `foreign` lists other players' files found while not DM (for the warning).

- [ ] **Step 1:** Write `test/party.test.js` with at least these cases, then run it (FAIL: module missing):
  - meFromTsv: exact match; `/a/vault` must not match `/a/vault 2` nor `/a/vault/sub`; paths with spaces; missing file text `""`.
  - tsvWith: add, replace, remove, keeps other vaults' lines.
  - paths: partPath/privateSessionPath/privatePath/sharedPath/privateOwner round-trips; sharedPath of a non-private path is unchanged.
  - privateNote: `"~@Halia lies"` → `{private:true, text:"@Halia lies"}`; `"  ~x"`; `"~~struck~~"` is NOT private (Lorekeeper treats `~~` as strikethrough); `"a ~ b"` not private.
  - joinOrNext: teammate wrote 2 h ago and I have no file → join; I have a file → next; teammate 13 h ago → next; n=0 → 1.
  - quietParty: my file 13 h old → true; 1 h → false; none of mine and others 1 h → false; none at all → true.
  - takeLines/privatizeLines: session line `- 20:14 ~@[[Lorelei]] secret` → `- 20:14 @[[Lorelei]] secret`; on NPC page Halia, `~ She had a deal with [[Lorelei]]` → `@[[Halia]] She had a deal with [[Lorelei]]`; a line already linking `[[Halia]]` gets no second link; a `- 20:05 x` line on a page gets `- 20:05 [[Page]] x`.
  - visiblePrivate: me=Vex not DM, paths include `Private/Vex/...` and `Private/Sibling 5/...` → show only Vex's, foreign Sibling's; isDM → show both, foreign empty.
- [ ] **Step 2:** Implement `_lorekeeper/lib/party.js`. Write `_lorekeeper/templates/session-part.md`:
  ```
  ---
  session: {{session}}
  date: {{date}}
  author: {{author}}
  ---
  ## Notes

  ```
  (`{{author}}` becomes `"[[<name>]]"`, or `DM` for the DM.) Add `party` to MODULES.
- [ ] **Step 3:** `npm test` green, stage, make:manifest, commit `feat(Party): the rules for who writes where in a shared campaign`.

### Task 2: Who am I

**Files:** Create `_lorekeeper/lib/identity.js`, `_lorekeeper/scripts/pick-character.js`; modify quickadd `data.json` (choice `lk-pick-character`, "Pick your character"), load.js; tests `test/identity.test.js`, scripts.test.js entry.

**Interfaces:** `identity.js` exports `KEY = "lorekeeper-me"`, `me(app): string` (`app.loadLocalStorage(KEY) ?? ""`), `async setMe(app, name, { fs, os, path, desktop })` — `app.saveLocalStorage(KEY, name || null)`; when `desktop` (Obsidian `Platform.isDesktopApp`) and `fs` given, read/modify/write `~/.config/lorekeeper/me.tsv` with `party.tsvWith` (creating the folder), using `app.vault.adapter.basePath` as the vault path; any file error is caught and returned as a warning string (the in-Obsidian choice still applies). Fakes in tests for `app`, `fs`, `os`, `path`.

Script: lists `PCs/*.md` basenames (sorted) plus **I'm the DM (no character)** and **Play solo** with `quickAddApi.suggester`; refuses a PC named `DM` ("A PC page named DM can't be the character you play."); passes `require("fs")`, `require("os")`, `require("path")` only on desktop (`obsidian.Platform.isDesktopApp`, `window.require`); Notice: "You play <name>." / "You're the DM." / "Playing solo." (plus any warning: "Couldn't tell the note box outside Obsidian: <warning>").

- [ ] Tests first (store/clear localStorage; tsv written/replaced/removed through fake fs; desktop false skips fs; fs error → warning), implement, stage via index for quickadd data.json if its working copy is modified, make:manifest, commit `feat(Party): pick the character you play, per device`.

### Task 3: Capture in party mode (inside Obsidian)

**Files:** Modify `_lorekeeper/lib/session.js` (add party-aware helpers, keep existing exports unchanged), `scripts/quick-note.js`, `scripts/new-session.js`, `scripts/open-session.js`; tests `test/session.test.js` (new cases only).

**Interfaces (add to session.js):**
- `PART_TEMPLATE = "_lorekeeper/templates/session-part.md"`
- `async ensureSession(io, n, now)` = existing `startSession` (view page).
- `async startPart(io, n, name, now, { privateFile = false } = {})` → path: ensures the view page, then creates `partPath(n,name)` (or `privateSessionPath(n,name)`) from the part template if missing (author `"[[name]]"` or `DM`); returns the path. Party helpers come from the caller (pass `party` in: `startPart(io, party, n, name, now, opts)`), since lib modules can't require each other.
- `async currentParty(io, party, name, nowMs)` → `{ n, path, quiet }` using `party.quietParty` over `Session N/` mtimes (io.list + io.mtimeMs) and `Session N.md`.
- `async newSessionNumber(io, party, name, nowMs)` → `party.joinOrNext(...)`.

Scripts: read `lk.identity.me(app)`; empty → current solo code path unchanged. Party: Quick note uses `currentParty` and `startPart` (offering the next session when quiet, as now) and opens your part file; **New session** uses `newSessionNumber` then `startPart` and opens it; **Current session** opens `Session N.md` (the view). Quick note does not apply `~` (you type in the editor; use **Make line private**).

- [ ] Tests first for the new helpers (solo tests untouched), implement, make:manifest, commit `feat(Party): quick notes and new sessions go to your own file in a shared session`.

### Task 4: lk-note in party mode

**Files:** Modify `_lorekeeper/capture/lk-note`; test `test/lk-note.test.js` (new cases).

- Identity: unless `--me NAME` is given, read `${XDG_CONFIG_HOME:-$HOME/.config}/lorekeeper/me.tsv` and take the name on the line whose first tab-separated field equals the vault's absolute path exactly (`awk -F'\t' -v v="$vault_abs" '$1==v {print $2; exit}'`; `vault_abs=$(cd "$vault" && pwd)`).
- Party (name non-empty): `~` prefix (after collapsing whitespace) → private: strip it, write `Private/<name>/Sessions/Session N.md`; else `Sessions/Session N/<name>.md`. Create the view page `Sessions/Session N.md` from the session template if missing, and the part file from `session-part.md` (`{{author}}` → `"[[<name>]]"` or `DM`). Quiet = your part file older than 720 min (or none of yours and nothing in the folder or view newer than 720 min). `--next` uses the join rule: join N when you have no part file in it and anything in `Sessions/Session N/` or the view changed within 720 min, else N+1. Solo (no name): unchanged.
- Smart hotkey and dialogs unchanged.
- [ ] Tests (temp `HOME`, `LK_NO_DIALOG=1`): party note to part file with frontmatter author; `~` note to private file and never to the part file; exact-path match (a `me.tsv` line for `<vault> 2` doesn't apply); `--me DM` writes `DM.md` with `author: DM`; quiet uses your own file's age; `--next` joins a teammate's fresh session; solo tests unchanged; shellcheck clean; also pass under dash. Commit `feat(Capture): the note box writes your own file, and ~ notes stay private`.

### Task 5: The session view for a party

**Files:** Modify `_lorekeeper/scripts/session.js` (the dv.view), `theme/theme.src.css` (+ build), `test/scripts.test.js`/`test/theme.test.js` as needed.

- Gather parts as now (`Session N.md` + `Session N/*.md`, author = basename; `DM.md` shows **DM**), plus private session files: every `Private/*/Sessions/Session N.md` that exists (io.list of `Private`), filtered by `lk.party.visiblePrivate({ me, isDM: me === "DM", paths })`. Private notes are merged in with `author` = owner and a `private: true` flag; rendered with a padlock (`lk-private` class) and, for the DM, the player's name.
- Author portraits: for an author with a `PCs/<author>.md` page whose frontmatter `portrait` is an embed or path to an image in the vault, render a small round image before the author name (`lk-portrait`); none for DM or when missing. Read frontmatter via `dv.page`.
- Misconfiguration: when `foreign` is non-empty, render at the top **Other players' private notes are on this device: check your sync setup (docs/PARTY.md).** (`lk-warning`), and never render those notes.
- Theme: `.lk-private::before` padlock (mask from Lorekeeper icons `lock`), `.lk-portrait` (18px round), `.lk-warning` (seal colours), padlock on the `Private` folder in the file list (add to FOLDER_ICONS: `Private: "lock"`). Build the theme.
- [ ] Put the filtering/merging logic in pure functions where possible (party.visiblePrivate exists; add `notes.mergeWithPrivate` if needed, tested). Commit `feat(Sessions): sessions show everyone's notes with portraits, and your private notes with a padlock`.

### Task 6: Private pages and Make line private

**Files:** Create `_lorekeeper/scripts/make-line-private.js`, `make-private.js`, `make-shared.js`; modify `scripts/new-page.js`, quickadd `data.json` (choices `lk-line-private` "Make line private", `lk-make-private` "Make private", `lk-make-shared` "Make shared"), `.obsidian/hotkeys.json` (`quickadd:choice:lk-line-private`: Mod+Shift+P; check `Mod+Shift+P` isn't an Obsidian default you'd clobber, and if it is, clear that default as M1 did), tests.

- **Make line private:** party mode only (solo: "Pick your character first: Make line private needs to know whose private notes they are."). Active markdown editor; selected lines or the cursor line. Destination: if the open file is `Session N.md` or `Sessions/Session N/<x>.md` → that N; else the current session (`currentParty`), and `page = { name: basename, kind: frontmatter type }`. Write `privatizeLines` output to `startPart(..., { privateFile: true })` FIRST (appendLine per line); only then remove the lines from the editor with `editor.replaceRange` (so unsaved typing is safe). Notice "Moved N notes to your private notes." Refuse inside frontmatter.
- **Make private:** party mode; open file not already under `Private/`; target `party.privatePath(path, name)`; create folders; `app.fileManager.renameFile(file, target)` (links follow). **Make shared:** file under `Private/<name>/` (someone else's: refuse "That's <owner>'s private page."); `yesNoPrompt("Share <page> with the party?", "Everyone who shares this campaign gets it.")`; rename to `sharedPath`; refuse if the target exists ("There's already a shared page called <name>.").
- **New page:** in party mode after the name, `suggester(["Shared", "Private"])`; private → folder `Private/<name>/<kind folder>`.
- [ ] Pure parts tested (party.takeLines/privatizeLines exist); glue tested with a fake app/editor (lines moved only after the write; refusals). Commit `feat(Party): make a line or a page private, and private pages from New page`.

### Task 7: Docs, version, roadmap

**Files:** Create `docs/PARTY.md`; modify README, Cheat Sheet.md, docs/CHECKLIST.md, `package.json` (version 0.3.0), M1 spec roadmap (M3 rows: party features done, plugin decision closed), `test/updater.test.js` (the parked hard-coded "0.3.0" fake release becomes one version past the committed lorekeeper.json), CREDITS if needed; make:manifest.

- PARTY.md per spec §5 (Relay: what to share, private folders shared with player + DM, don't share `_lorekeeper/`/`.obsidian/`; Obsidian Sync: exclude `Private` per device, so private stays local; capabilities table; conflicts; same version everywhere via **Update Lorekeeper**; **Pick your character** first on each device; `lk-note` picks it up automatically on desktop).
- README: a **Playing with your party** section; Cheat Sheet: `~` prefix, **Pick your character**, **Make line private** (`⌘⇧P` / `Ctrl+Shift+P`), **Make private**, **Make shared**.
- CHECKLIST: the spec's M3 items.
- [ ] npm test, check:manifest, check:theme green. Commit `docs(Party): playing with your party, with Relay or Obsidian Sync`.

### Task 8: Release v0.3.0 (USER GATE)

- [ ] Merge `m3` into `main` locally (after the final review), tests green.
- [ ] STOP: show the user the exact commands and get a yes.
- [ ] `git push origin main`, `git tag -a v0.3.0 -m "v0.3.0: party play"`, `git push origin v0.3.0`, `gh release create v0.3.0 --latest --title v0.3.0 --notes "Party play: pick your character, everyone's notes in each session, private notes and pages, a DM without a character, and setup guides for Relay and Obsidian Sync."`. Verify `releases/latest` is v0.3.0 and CI is green.
