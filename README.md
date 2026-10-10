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
