# Lorekeeper for Obsidian

Session notes for D&D players, as an Obsidian vault: jot things down during the game without leaving Discord, read each session as a Timeline or a Journal, and keep a vault of NPCs, places and quests. One vault per campaign. It's [Lorekeeper](https://github.com/yonatankarp/lorekeeper)'s workflow and look, without the app.

## Start a campaign

1. On GitHub, **Use this template** (or clone it) and name the copy after your campaign.
2. In Obsidian, **Open folder as vault** and pick it (Obsidian 1.13 or later). Choose **Trust author and enable plugins**: the vault uses QuickAdd, Templater, Dataview and Custom Selectors, already set up.
3. In **Settings > Templater**, turn on **Trigger Templater on new file creation**. Obsidian keeps it per device, so do this once on each computer.
4. Open **Home** from the bookmarks.
5. For notes over Discord without opening Obsidian, set up the hotkeys in [docs/CAPTURE.md](docs/CAPTURE.md). The hotkeys outside Obsidian are tested on macOS; the Windows and Linux setups in that file are untested.

## During the game

Press `⌘⌥N` (`Ctrl+Alt+N`) and type `@Mirela, shifty innkeeper`. Start a note with a symbol to file it: `@` NPCs, `#` loot, `!` quests, `?` mysteries, `"` quotes, nothing for what happened. Inside Obsidian the same hotkey opens a new line in the current session, with link suggestions.

## After the game

- Open a session (`⌘J` or `Ctrl+J` for the current one): open quests at the top, then its notes as a **Timeline** or a **Journal**, then the raw notes under **Notes**, where you edit them.
- **New page** (`⌘N` or `Ctrl+N`): pick NPC, PC, Location, Item, Faction, Quest, Lore or your own (any file you add to `Templates/`), and name it. Clicking a link to a page that doesn't exist yet asks the same.
- Quests have a **status** (open, in progress, done, failed). NPCs have a **condition** (alive, dead, missing, unknown) and an **attitude** (friendly, neutral, hostile, unknown).
- A session's `title` property names it: "The bridge collapse".
- **Home** lists open quests, recent sessions and NPCs. The graph (`⌘G` or `Ctrl+G`) maps the connections.
- Status shows as a mark: done quests are ticked, failed ones crossed out, dead NPCs crossed out, all dimmed, in the file list. Friendly NPCs are green, hostile red and missing ones purple, in the file list (lighter on the leather sidebar), in links on pages and on Home.
- Everything is in the **Cheat Sheet** (`⌘/` or `Ctrl+/`).

## Updating

Run **Update Lorekeeper** from the command palette (`⌘P` or `Ctrl+P`). It shows what will change and asks first. Pages you wrote and templates you edited are kept. Reload Obsidian when it asks.

## Backups

Back up to a private GitHub repository with Obsidian's **Git** plugin: see [docs/BACKUP.md](docs/BACKUP.md). Run **Check backup** from the command palette to see whether the vault is ready.

## Characters from D&D Beyond

**Import from D&D Beyond** fills PC pages from a character link, and **Refresh from D&D Beyond** updates one later: see [docs/DNDBEYOND.md](docs/DNDBEYOND.md).

## Playing with your party

Share the vault with your group through Relay or Obsidian Sync, and each player's notes stay in their own file, shown together with their names in every session. Run **Pick your character** on each device (a PC, or **I'm the DM (no character)**). Start a note with `~` in the note box, or run **Make line private** (`⌘⇧P` or `Ctrl+Shift+P`) on a line in the editor, to keep it in your private notes. **Make private** and **Make shared** move a whole page. Setting up the sync, and what each service can't do: [docs/PARTY.md](docs/PARTY.md).

## Not here yet

Roles, invites, who's online and time zones aren't in the vault (Lorekeeper's app has them).

## Development

```bash
npm test                 # unit tests (Node 20+)
npm run build:theme      # rebuild .obsidian/themes/Lorekeeper/theme.css from theme/
scripts/update-plugins.sh  # download the plugin versions in plugin-versions.txt
```

Credits: [CREDITS.md](CREDITS.md). Licence: MIT, except the fonts and `theme.css` (CC BY-SA 4.0) and the bundled plugins, each under its own licence (Templater is AGPL-3.0).
