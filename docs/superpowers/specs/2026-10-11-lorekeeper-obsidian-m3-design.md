# Lorekeeper for Obsidian: M3 design (party play)

Date: 2026-10-11. Status: approved in conversation. Builds on the M1 and M2 specs; their rules still hold (behaviour follows Lorekeeper's `docs/GUIDE.md` "Playing with your party", logic in tested `_lorekeeper/lib/`, commands as QuickAdd scripts, no plugin of our own).

## Goal

A party keeps one campaign together: each player's notes stay their own files, every session shows everyone's notes with authors, private notes stay out of shared files, and a DM can play without a character. **Sync-agnostic:** M3 builds only the vault side; `docs/PARTY.md` says how to set it up with Relay or Obsidian Sync and what each can't do.

**Decisions (2026-10-10/11):** sync-agnostic; no plugin of our own (the plugin decision point is closed: revisit only if a gap that needs one comes up); a `~` line typed in the editor becomes private through a command, not on save. Accepted losses unchanged: roles, invites, who's online, time zones.

## 1. Who am I

**Pick your character** (QuickAdd) lists the pages in `PCs/` and **I'm the DM (no character)**, and **Play solo** to clear it. The choice is kept per device and never synced:
- inside Obsidian: `app.saveLocalStorage("lorekeeper-me", value)` (per vault, per device);
- on desktop, also a line `<absolute vault path>\t<name>` in `~/.config/lorekeeper/me.tsv` (one line per vault, replaced on change, removed for solo), so `lk-note` (outside Obsidian) knows too. Mobile has no `lk-note`.

`<name>` is the PC page's name, or `DM`. A PC page named `DM` can't be picked. **Party mode = a character (or DM) is picked.** No pick keeps M2's solo behaviour exactly.

## 2. Notes from each player

In party mode the three capture paths (Quick note, the system note box via `lk-note`, New session) write `Sessions/Session N/<name>.md`, made from `_lorekeeper/templates/session-part.md` (`session`, `date`, `author: "[[<name>]]"` or `author: DM`, and `## Notes`). Two players never write the same file.

`Session N.md` stays the session's page (the view block, plus any notes written before sharing). Capture creates it from the session template when missing; it's identical for everyone, so two players making it at once is harmless.

The current session is still the highest N among `Session N.md` and `Session N/`. **Quiet** in party mode means your own file in it hasn't changed in 12 hours (or you have none and the session has had no change in 12 hours). **New session** joins a session a teammate started in the last 12 hours when you haven't written in it yet (Lorekeeper's `going` rule); otherwise it starts the next.

The session view's Timeline and Journal (already merging per-author files) show each author's PC portrait (the PC page's `portrait`, else nothing) and **DM** for `DM.md`.

## 3. Private notes

`Private/<name>/` mirrors the vault: `Private/<name>/Sessions/Session N.md` for private session notes, `Private/<name>/NPCs/…` for private pages.

- **`~` prefix:** a note starting with `~` from any capture path goes to `Private/<name>/Sessions/Session N.md` (same session, same line format, the `~` removed). Solo mode keeps `~` as typed (M2 behaviour).
- **Make line private** (`⌘⇧P` / `Ctrl+Shift+P`): moves the current line, or the selected lines, out of the open page into your private notes. On a session page (or a per-author file) they go to that session's private file; on any other page to the latest session's, with a link to the page added first when the line has none (`@[[Name]] ` for an NPC page, `[[Name]] ` otherwise), as in Lorekeeper. A leading `~` is dropped. Says **Moved N notes to your private notes**.
- **Make private / Make shared:** moves the open page between `X` and `Private/<name>/X` with Obsidian's rename (links follow). Make shared asks first: **Share <page> with the party?**
- **New page** asks **Shared or private?** in party mode; private pages go under `Private/<name>/`.
- **Seeing them:** session views show your private notes with a padlock. Obsidian's backlinks panel already lists private files that link a page, and only vaults holding those files see them. The theme marks `Private/` with a padlock.

## 4. DM

**I'm the DM** writes `Sessions/Session N/DM.md` and `Private/DM/…`, shown as **DM** without a portrait.

When the sync puts players' `Private/<PC>/` folders in the DM's vault, the DM's session view shows those private notes with the player's name and a padlock. **Only the DM's view does.** On any other device, finding another player's private folder means the sync is set up wrong: the view hides those notes and shows **Other players' private notes are on this device: check your sync setup (docs/PARTY.md).**

## 5. docs/PARTY.md

- **Relay:** share the campaign's folders with everyone; share each `Private/<PC>/` with that player and the DM only; don't share `_lorekeeper/` or `.obsidian/` (updates and settings stay per vault).
- **Obsidian Sync (shared vault):** everything is shared, so **`Private/` is not private**: exclude `Private` in **Settings > Sync > Excluded folders** on every device (private notes then stay on that device only).
- What each can't do (Obsidian Sync: no DM-only notes; Relay: not end-to-end encrypted), conflicts (Relay merges live; Obsidian Sync merges or keeps both), and that everyone needs the same Lorekeeper version (run **Update Lorekeeper** on each device).
- Steps written from each service's docs; a live test with real accounts is on the checklist.

## Testing

Pure logic in `lib/party.js` (paths, who-am-I file, quiet and join rules, moving lines, which private notes a view shows) with unit tests; Obsidian glue tested with fake apps as in M2; `lk-note` party mode tested with a temporary `HOME`. Checklist gains: two devices taking notes in one session, `~` notes, Make line private, Make private/shared, a DM seeing private notes through Relay, the misconfiguration warning, and both sync setups.

## Out of scope

Roles, invites, presence, time zones (accepted); a plugin of our own; the editor kind colours.
