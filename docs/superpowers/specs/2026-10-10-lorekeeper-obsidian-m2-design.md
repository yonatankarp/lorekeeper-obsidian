# Lorekeeper for Obsidian: M2 design

Date: 2026-10-10. Status: draft for review. Builds on `2026-10-10-lorekeeper-obsidian-design.md` (M1, its decisions and the roadmap there still hold).

## Goal

Finish solo parity: updates that reach a vault already full of notes, Lorekeeper's status marks and attitude colours, a backup path, and D&D Beyond import with optional sign-in. After M2 comes the plugin decision point from the M1 roadmap.

M2 keeps M1's rules: behaviour follows Lorekeeper's `docs/GUIDE.md`, logic lives in tested CommonJS under `_lorekeeper/lib/` loaded by `load.js`, commands are QuickAdd scripts, no plugin of our own, every third-party plugin pinned and committed.

## 1. Updates

**Releases.** The template repo is published as the public GitHub repo `yonatankarp/lorekeeper-obsidian`, with tagged releases. M1 is tagged `v0.1.0`. Each release has a `lorekeeper.json` at the repo root listing every file it ships: path, SHA-256 and category. `scripts/make-manifest.js` writes it; CI fails when it's stale.

**Categories.**
- **Managed** files belong to the template and are always replaced: `_lorekeeper/**`, `.obsidian/themes/**`, `.obsidian/plugins/*/main.js`, `manifest.json`, `styles.css` and `LICENSE`, `CREDITS.md`, `docs/CAPTURE.md`, `docs/BACKUP.md`.
- **Shared** files start as the template's and may be edited by the player: `Templates/*.md`, `.obsidian/plugins/*/data.json`, `.obsidian/hotkeys.json`, `.obsidian/app.json`, `.obsidian/appearance.json`, `.obsidian/core-plugins.json`, `.obsidian/community-plugins.json`, `.obsidian/graph.json`, `.obsidian/bookmarks.json`, `Home.md`, `Cheat Sheet.md`. An update replaces one only when its current hash equals the hash the last update installed; otherwise it's left alone and listed as edited. Shared JSON settings files are compared on the template's own top-level keys in canonical form, because Obsidian rewrites them on first open; replacing one merges the template's keys over the player's file.
- Everything else (the player's notes, `README.md`, `docs/superpowers/`, tests, `scripts/`, `theme/` sources) is not in the manifest and is never touched.

**The command: Update Lorekeeper** (QuickAdd script `update.js`, logic in `lib/update.js`).
1. Fetch the latest release from `https://api.github.com/repos/yonatankarp/lorekeeper-obsidian/releases/latest`, then its `lorekeeper.json` from `raw.githubusercontent.com` at that tag.
2. Hash the vault's copies (`crypto.subtle`), read `_lorekeeper/installed.json`, and plan: **new**, **replace**, **kept (you edited it)**, **remove** (a managed or unedited shared file the release no longer ships). A file the player edited is never replaced or removed.
3. Show the plan (counts plus the edited list) and ask **Update to vX.Y.Z?** Nothing is written before the answer.
4. Write the files (Obsidian's `requestUrl` for downloads), then write `_lorekeeper/installed.json` (`version` and every installed file's hash) last, so a failed update can simply be run again.
5. When a plugin or the theme changed, offer **Reload Obsidian**.

Already on the latest version: say so and stop. Offline or GitHub unreachable: say so, change nothing.

**Vaults without installed.json:** a clone of v0.2.0 or later uses its own root `lorekeeper.json` (which the updater never writes) as the installed record, and an M1 vault uses the `v0.1.0` baseline manifest, so an untouched file counts as unedited. An installed version at or above the release is up to date: the updater never downgrades.

`planUpdate(installed, current, release)` is a pure function with unit tests; the network and file writes are a thin wrapper. Works on desktop and mobile.

**Trust:** the update runs whatever the public repo serves, like any community plugin. Pushing to the repo is pushing to every vault that updates.

## 2. Status marks and colours

**One more plugin, pinned and committed: Supercharged Links 0.14.0** (`mdelobelle/obsidian_supercharged_links`, MIT). Set to target `status`, `condition` and `attitude`, with the file list on. Its companion Style Settings is not used: the Lorekeeper theme holds the CSS.

The theme styles links by the attributes the plugin adds, with Lorekeeper's rules (`src/styles.css:336-490` at 32a07f6, and the guide):

| Where | Look |
|---|---|
| File list | quest `done`: dimmed, a check; `failed`: dimmed, a cross; NPC `condition: dead`: dimmed, a cross (Lorekeeper's `done` and `failed` icons) |
| File list, links in notes, Bases cells (Home) | NPC `attitude`: friendly green (`--lk-kind-quest`), hostile red (`--lk-seal-hi`, mixed with the text colour for dark mode), unknown or empty: plain |
| File list, links | NPC `condition: missing`: mystery purple (`--lk-kind-mystery`) |

This covers the M1 roadmap rows "Status markers in the file list" and "NPC attitude colours on Home".

Before writing CSS, the plan reads the plugin's `main.js` for the exact attribute names and settings keys. A test checks that the theme styles every value in the Custom Selectors lists that has a look in the table.

Colouring note lines by their `@`/`#` prefix while editing stays out of M2: accepted loss, or the plugin decision.

## 3. Backups

**Obsidian Git 2.41.1** (`vinzent03/obsidian-git`, MIT), pinned and committed, **turned off** in `community-plugins.json` (on, in a folder that isn't a git repo, it complains at every start). Its settings ship to match Lorekeeper's rhythm: Obsidian Git backs up every 30 minutes, and pulls on start. The plugin shows in Obsidian as **Git**.

**docs/BACKUP.md:**
1. Create a **private** GitHub repo for the campaign.
2. Point the vault at it. A vault cloned from the template has `origin` set to the public template: replace it first (`git remote set-url origin <your repo>`), or start fresh with `git init`.
3. Turn on Obsidian Git in **Settings > Community plugins**.
4. Restore: a page's **History** on github.com, or `git checkout` an older version.

Also covered: Obsidian's **File recovery** (on since M1) for local snapshots, and that Obsidian Git on mobile is slow and limited.

A check guards the trap in step 2: **Check backup** (QuickAdd script) reads `.git/config` through the adapter and warns when `origin` points at `yonatankarp/lorekeeper-obsidian`. It's linked from BACKUP.md. No cloud-drive option and no restore dialog: accepted.

## 4. D&D Beyond import

A port of Lorekeeper's import (`src-tauri/src/dndbeyond.rs` and the code that updates PC pages) into `lib/dndbeyond.js`, with the same source and rules.

**Lookup.** A character link (`dndbeyond.com/characters/<id>/…`, the short form, or a bare id). Each character is read from `https://character-service.dndbeyond.com/character/v5/character/<id>` with `requestUrl`; the character's party brings in the rest, up to Lorekeeper's `MAX_CHARACTERS`. Campaign links aren't supported: Obsidian's requestUrl follows redirects without showing where, so the sign-in cookie could follow a redirect off D&D Beyond. A character link brings its party along instead. One that can't be read shows its error without failing the rest.

**Mapping** (`parse_character`, line for line): `race` (full name, else base name); `class` ("Fighter (Champion)", or "Fighter 3 / Rogue 1"); `level` (sum of class levels); `background` (else the custom background); `alignment` (from the 1-to-9 table); `dndbeyond` (the sheet link); `player` (the D&D Beyond username); **Appearance** (gender, age, height, weight, eyes, hair, skin joined with ` · `, then the appearance text); **Personality** (Traits, Ideals, Bonds, Flaws, bold-labelled, several lines become a list).

**Page rules, as in Lorekeeper:** update the PC page whose `dndbeyond` links to the sheet, else the one with the character's name in `PCs/`, else make a new page from the PC template. `race`, `class`, `level`, `background`, `alignment` and `dndbeyond` are updated; `player` and `portrait` are filled only when empty; **Appearance** and **Personality** only while those sections are empty. Nothing else changes.

**Portrait:** only https on `dndbeyond.com` or a subdomain, at most 10 MB, and only a real JPG, PNG, GIF or WebP by its first bytes. Saved to `Attachments/` and set as `portrait`.

**Commands:**
- **Import from D&D Beyond:** asks for a link, lists the characters found (each ticked, untick to skip), imports.
- **Refresh from D&D Beyond:** on the open PC page, reads its `dndbeyond` link and updates it.
- **Sign in to D&D Beyond** / **Sign out of D&D Beyond.**

**Sign-in (optional).** Import works without it for public characters. Sign-in unlocks "Campaign Only" characters. The player signs in to D&D Beyond in their own browser, copies the `CobaltSession` cookie from the browser's developer tools, and pastes it into the sign-in prompt. `docs/DNDBEYOND.md` gives the steps for Chrome, Safari and Firefox and says what the cookie is (it's their D&D Beyond session: treat it like a password). The cookie is kept only in Obsidian's secret storage (`app.secretStorage`), never in a vault file, so backups never carry it. Each lookup trades it for a short-lived token at `https://auth-service.dndbeyond.com/v1/cobalt-token` (Lorekeeper's `cobalt_token`). An expired cookie gives a clear "Sign in to D&D Beyond again" message. A private character met while signed out says "This character is private: sign in to D&D Beyond to import it".

**Tests:** parsing, page updates, the portrait checks and link parsing are pure functions, tested with fixture JSON trimmed from a public character and cases from Lorekeeper's Rust tests. Network calls go on the checklist.

**Risk:** D&D Beyond's services are unofficial and can change; Lorekeeper has the same risk. A failure shows an error and writes nothing.

## Testing

Unit tests for `lib/update.js`, `lib/dndbeyond.js` and the manifest generator; config tests for the two new plugins (pinned, enabled or not as specified, settings keys) and for the theme covering every styled value. `docs/CHECKLIST.md` gains: an update from a `v0.1.0` vault with one edited template, the status marks in the file list in both themes, Home's NPC colours, backup setup with the origin check, an import and a refresh of a public character, sign-in with a pasted cookie and a Campaign Only character, and mobile for update and import.

## Out of scope (after M2)

The plugin decision point; editor kind colours; `[[` suggestions and `↑` in the system note box; a sign-in window; party play (M3).
