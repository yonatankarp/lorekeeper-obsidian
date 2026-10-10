# Backups

Lorekeeper's vault backs up with **Git** (the Obsidian Git plugin): every change becomes a version in a private GitHub repository of yours, and a page's **History** on github.com shows its older versions. It comes with the vault, turned off.

1. **Create a private repository** on GitHub for this campaign (say `strahd-notes`). Leave it empty. Don't fork the Lorekeeper repository for your notes: a fork of a public repository is public.
2. **Point the vault at it.** In a terminal in the vault's folder:
   - A vault you got with `git clone` of the Lorekeeper repository still points at the public template, so your notes would go there: `git remote set-url origin git@github.com:<you>/strahd-notes.git`
   - A vault made with **Use this template** already points at your own repository; check it's private.
   - A downloaded copy isn't a git repository yet: `git init`, then `git remote add origin git@github.com:<you>/strahd-notes.git`

   Then run **Check backup** from the command palette (`⌘P` or `Ctrl+P`): it says whether the vault is ready, and warns if it still points at the template.
3. **Turn on Git** in **Settings > Community plugins**. It commits and pushes every 30 minutes (a check with nothing new does nothing), and pulls when Obsidian starts.
4. **To get an older version back:** open the page on github.com and use **History**, or in Obsidian use **Git: Open history view**.

**Short-term undo:** Obsidian's **File recovery** (on since the start, **Settings > File recovery**) keeps local snapshots of each page.

**On a phone or tablet,** Obsidian Git works but is slow and limited. Back up from a computer.
