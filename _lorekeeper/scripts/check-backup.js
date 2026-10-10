// QuickAdd: Check backup. Says whether Obsidian Git can back this vault up, and warns before it pushes to the template.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  const { adapter } = app.vault;
  if (!(await adapter.exists(".git/config")) && (await adapter.exists(".git"))) {
    new obsidian.Notice("Can't check the backup: this vault's .git is a link to another repository. Check its origin with git remote -v.", 0);
    return;
  }
  const config = (await adapter.exists(".git/config")) ? await adapter.read(".git/config") : null;
  const { level, message } = lk.backup.backupStatus(config, app.plugins.enabledPlugins.has("obsidian-git"));
  new obsidian.Notice(message, level === "warn" ? 0 : 5000);
};
