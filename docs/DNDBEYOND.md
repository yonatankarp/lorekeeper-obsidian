# Characters from D&D Beyond

**Import from D&D Beyond** (command palette, `⌘P` or `Ctrl+P`): paste a character link (`dndbeyond.com/characters/…`) or its number. The character's party comes along. Untick any you don't want, and each one updates its page in `PCs/` (the one linking to its sheet, else the one with its name) or gets a new page from the PC template.

**Refresh from D&D Beyond** on an open PC page reads the character again, say after a level up.

What D&D Beyond updates: `race`, `class` (with subclass), `level`, `background`, `alignment` and the `dndbeyond` sheet link. `player` and the `portrait` (saved into `Attachments/`) are only filled in when empty. **Appearance** and **Personality** are written only while those sections are empty. Nothing else on the page changes. **Edit > Undo** (`⌘Z` or `Ctrl+Z`) works on each page.

Public characters work without signing in. Characters set to Campaign Only need you signed in. A campaign link isn't accepted: paste a link to one character in the campaign, and its party comes along.

## Signing in

D&D Beyond doesn't let other apps sign you in, so you copy your sign-in cookie from your browser once. It's your D&D Beyond session: treat it like a password and don't share it. Lorekeeper keeps it in Obsidian's secret storage, never in a file in your vault, so backups never include it.

1. Sign in at dndbeyond.com in your browser.
2. Open the developer tools: **Chrome** `⌥⌘I` / `Ctrl+Shift+I`, then **Application > Cookies > https://www.dndbeyond.com**. **Firefox** `⌥⌘I` / `Ctrl+Shift+I`, then **Storage > Cookies**. **Safari**: turn on **Settings > Advanced > Show features for web developers**, then `⌥⌘I` and **Storage > Cookies**.
3. Copy the value of **CobaltSession**.
4. In Obsidian, run **Sign in to D&D Beyond** and paste it.

When it expires, imports say **Your D&D Beyond sign-in expired**: sign in again the same way. **Sign out of D&D Beyond** removes it.
