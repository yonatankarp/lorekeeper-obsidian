# Playing with your party

One campaign, one vault each. Every player keeps their own notes in their own files, a session shows everyone's notes with who wrote them, and private notes stay out of the shared files. Lorekeeper builds the vault side. How the vault reaches your friends is up to a sync service: this page covers **Relay** and **Obsidian Sync**. Steps for both are written from each service's own documentation and are not yet tested with real accounts, so check them against the service's current docs.

## Set up

1. Everyone uses the same vault and the same Lorekeeper version. Run **Update Lorekeeper** from the command palette (`⌘P` or `Ctrl+P`) on every device.
2. On each device, run **Pick your character** (QuickAdd, shows as "QuickAdd: Pick your character"). Choose your PC page, **I'm the DM (no character)**, or **Play solo**. The choice is per device and never synced, so do it on each computer and phone you play on. On desktop, the note box outside Obsidian (`⌘⌥N` or `Ctrl+Alt+N`) picks it up automatically.
3. Set up the sync as below, before anyone writes a private note.

Until a character or the DM is picked on a device, that device works as a solo vault.

## What changes in a shared campaign

- **Your notes are your file.** Quick note, the note box and **New session** write to `Sessions/Session N/<your name>.md`. Two players never edit the same file. The DM's file is `DM.md`.
- **The session page shows everyone.** The Timeline and Journal merge every file in the session and name the author, with the PC's portrait. The DM shows as **DM**.
- **Quiet sessions.** A session is quiet when your own file in it hasn't changed in 12 hours (or you have none and nobody has written in 12 hours). An empty `Session N/` folder counts as quiet too, and offers the next session. **New session** joins a session a teammate started in the last 12 hours when you haven't written in it yet.
- **Private notes** live in `Private/<your name>/`, which mirrors the vault: `Private/<name>/Sessions/Session N.md` for notes, `Private/<name>/NPCs/...` for pages.

## Private notes

| Command | What it does |
|---|---|
| `~` at the start of a note | In the system note box, the note goes to your private notes for the current session, with the `~` removed |
| **Make line private** (`⌘⇧P` / `Ctrl+Shift+P`) | Moves the current line, or the selected lines, out of the open page into your private notes |
| **Make private** | Moves the open page to `Private/<you>/`, links follow |
| **Make shared** | Moves one of your private pages back out, after asking **Share <page> with the party?** |
| **New page** | In a shared campaign it asks **Shared** or **Private** (Esc cancels) |

Details worth knowing:

- Quick note opens a line in the editor, so a `~` line typed there stays where it is until you run **Make line private**. A lone `~` isn't a note, and `~~text~~` is strikethrough, not private.
- **Make line private** on a session page sends the lines to that session's private file. On any other page it uses the latest session and adds a link to the page first, so the note keeps its context. It refuses the properties at the top of a page.
- **Make private** refuses `Sessions/`, `Templates/` and Lorekeeper's own files.
- If a page was already pushed to a shared git history (the **Git** backup, for example), making it private doesn't remove it from that history.
- **Your own** private notes show in the session view with a padlock and no name. The **DM** sees players' private notes with their names and a padlock, when the sync puts those folders on the DM's device. On any other device, another player's `Private/` folder means the sync is set up wrong: the session view hides those notes and shows a warning.
- Obsidian's backlinks panel lists any file that links a page, private ones included, but only on devices that hold those files.

## Relay

Relay shares folders between vaults and merges edits live.

- Share the campaign's folders with everyone: `Sessions`, `PCs`, `NPCs`, `Locations`, `Items`, `Factions`, `Quests`, `Lore` and `Attachments`.
- Share each `Private/<name>` folder with that player and the DM only, and that is how the DM sees private notes. Turn **Private** on for that shared folder, then add the player and the DM with **Add Users**. Private folders need a paid Relay Server plan, and the people you add must be Members or Owners of that server. Steps: https://docs.relay.md/guides/private-shared-folders
- **Warning:** without the **Private** toggle, a shared folder goes to everyone who has the server's Share Key, so private notes would be exposed to the whole party.
- Don't share `_lorekeeper/` or `.obsidian/`. Updates and settings stay per vault.

## Obsidian Sync

Obsidian Sync shares the whole vault, so **`Private/` is not private** unless you exclude it.

- On every device, open **Settings > Sync > Excluded folders > Manage** and add `Private`. This setting doesn't sync between devices, so set it on every device. Private notes then stay on the device that wrote them.
- The DM can't see players' private notes this way, and there are no DM-only notes.

## What each can and can't do

| | Relay | Obsidian Sync |
|---|---|---|
| Private notes the DM can see | Yes, with **Private** turned on for the folder (paid server plan) | No |
| Private notes stay on one device | Yes, don't share the folder | Yes, exclude `Private` on every device |
| DM-only notes | Don't share `Private/DM` | Don't share `Private/DM` |
| End-to-end encrypted | No, on Relay's cloud hosting (self-hosting keeps notes off Relay's servers) | Yes, by default for new vaults |
| Conflicts | Edits merge live | Obsidian merges, or keeps both copies |

Because each player writes their own file, conflicts are rare. They happen on shared pages such as NPCs, where two people editing the same page at once is the sync's job to merge.

## Not here

Roles, invites, who's online and time zones. Lorekeeper's app has them, the vault does not.
