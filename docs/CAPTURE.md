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

With Obsidian in front, ⌘⌥N opens **Quick note** inside Obsidian instead of the box.

**Save selection (`⌘⇧S`):**
1. **File > New Shortcut**, named **Lorekeeper Save Selection**. In **Details**, turn on **Use as Quick Action** and **Services Menu**, receiving **Text** from **Any app**. If there's no input: **Get Clipboard**.
2. Add **Run Shell Script**: Shell **zsh**, Pass Input **to stdin**, with the script:
   ```sh
   sh "/path/to/vault/_lorekeeper/capture/lk-note" --stdin
   ```
3. Open **System Settings > Keyboard > Keyboard Shortcuts > Services**, find **Lorekeeper Save Selection** under **Text**, and give it `⌘⇧S`. In apps with a **Save As…** on `⌘⇧S`, the app's own shortcut wins; pick another key if that gets in the way.

The first time, macOS asks to let Shortcuts control **System Events**: allow it, since the note box is a System Events dialog.

**New session without opening Obsidian (optional):** a third shortcut running `sh "/path/to/vault/_lorekeeper/capture/lk-note" --next`.

## Windows (untested)

Install [AutoHotkey v2](https://www.autohotkey.com) and [Git for Windows](https://git-scm.com/download/win). Open `_lorekeeper/capture/windows/lorekeeper.ahk` in a text editor, set `VAULT` to your vault's folder, save it and double-click it. `Ctrl+Alt+N` opens the note box and `Ctrl+Shift+S` saves the selection.

## Linux (untested)

Install `zenity` (and `xclip` for saving the selection on X11). In your desktop's keyboard settings, add:
- `Ctrl+Alt+N`: `sh /path/to/vault/_lorekeeper/capture/lk-note --dialog`
- `Ctrl+Shift+S`: `sh -c '{ xclip -o -selection primary 2>/dev/null || xclip -o -selection clipboard; } | sh /path/to/vault/_lorekeeper/capture/lk-note --stdin'`

## What lk-note does

`lk-note [--vault DIR] [--me NAME] [--next | --here] [--dialog | --stdin | TEXT…]` appends `- HH:MM text` to the newest `Sessions/Session N.md`, starting Session 1 if there's none. When the session hasn't changed in 12 hours, it asks **Start Session N+1?**, or exits with code 3 when it can't ask: run it again with `--next` to start the next session or `--here` to keep the current one.

In a shared campaign it writes your own file, `Sessions/Session N/<your name>.md`, and a note starting with `~` goes to your private notes instead. Your name comes from **Pick your character**, or from `--me NAME` (`--me DM` for the DM). If it can't tell who you are, it still saves an ordinary note to `Sessions/Session N.md`, but it refuses a `~` note (exit code 2) once the vault has a `Private/` folder or a `Sessions/Session N/` folder, because the note would be shared. See [PARTY.md](PARTY.md).
