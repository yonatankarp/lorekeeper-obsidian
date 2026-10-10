# Manual checklist

Run before tagging a release, in a fresh copy of the vault (`cp -R` the repo, without `.git`), opened in Obsidian.

- [ ] **Plugins:** all four turned on after **Trust author and enable plugins**.
- [ ] **Theme:** Light and Dark next to `docs/screenshots/light.jpg` and `dark.jpg` in the Lorekeeper app repo: parchment and leather sidebar, stone and gold, D&D fonts, the drop cap, folder icons, no `_lorekeeper` folder.
- [ ] **Capture over Discord (macOS):** `⌘⌥N` saves a note and Discord keeps focus; `⌘⇧S` saves a selection and, with nothing selected, the clipboard.
- [ ] **Quiet session:** `touch -t 202601010000` on the newest session, then `⌘⌥N` asks **Start Session N+1?** (outside Obsidian and inside).
- [ ] **Quick note in Obsidian:** `⌘⌥N` puts the cursor on a new `- HH:MM ` line, `[[` suggests pages, and closing it untyped shows no empty note in the session view (the bare time line stays in the file).
- [ ] **New page:** `⌘N` for each built-in kind lands in its folder with its template; a custom `Templates/Monster.md` shows up and goes to `Monsters/` if it exists; a taken name is refused.
- [ ] **Unresolved link:** clicking one asks **What is …?** and files the page.
- [ ] **Session page:** open quests with coins, Timeline in kind colours, Journal grouped, the toggle remembered.
- [ ] **Home:** open quests with a status dropdown, recent sessions with titles, NPCs grouped by attitude.
- [ ] **Rename:** `F2` on an NPC updates `@[[links]]` in sessions.
- [ ] **Mobile (if you sync the vault):** a session page renders its view.
- [ ] **Smart hotkey (macOS):** with Obsidian in front, `⌘⌥N` opens Quick note inside Obsidian, not the system box.
- [ ] **Bases syntax:** `sort` in sessions.base and the `#Open quests` embed on Home work, or use the fallbacks in the plan's Task 8.
- [ ] **Base64 fonts load** (text isn't in Georgia).
- [ ] **Templater toggle:** **Settings > Templater > Trigger Templater on new file creation** is on (it is kept per device). On first open no Templater notice appears, and `git status` shows `.obsidian/plugins/templater-obsidian/data.json` unchanged afterwards.
- [ ] **Quick note into an open session:** type a note in an open session, press `⌘⌥N` within 2 seconds: both notes are there.
- [ ] **Custom Selectors:** don't rename selectors in its settings (it can turn `status` into `selector.status`); the dropdowns for status, condition and attitude still show.
- [ ] **Update from v0.1.0:** in a vault from `v0.1.0` with one edited template, **Update Lorekeeper** shows the plan, lists the edited template as kept, asks, updates, and offers a reload. Run again: it says you're up to date.
- [ ] **Status marks:** in the file list, in Light and Dark, done quests are ticked, failed ones crossed out, dead NPCs crossed out, all dimmed; friendly NPCs green, hostile red, missing purple (lighter on the leather sidebar); the same colours in links on pages.
- [ ] **Home NPC colours:** NPCs on Home show attitude colours in both themes.
- [ ] **Backup setup:** **Check backup** in a clone of the template warns about the template origin; after `git remote set-url origin` it says ready; **Git** turned on commits and pushes.
- [ ] **D&D Beyond import and refresh:** import a public character (its party comes along, each ticked), then **Refresh from D&D Beyond** on its page.
- [ ] **D&D Beyond sign-in:** **Sign in to D&D Beyond** with a pasted cookie, then import a Campaign Only character; **Sign out of D&D Beyond** makes it say it's private again; a campaign link is refused.
- [ ] **Mobile (if you sync the vault):** **Update Lorekeeper** and **Import from D&D Beyond** work.
