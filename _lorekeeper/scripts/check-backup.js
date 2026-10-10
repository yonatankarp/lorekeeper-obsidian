// QuickAdd: Check backup. Says whether Obsidian Git can back this vault up, and warns before it pushes to the template.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { backup } = await m.exports(app);
  const config = (await app.vault.adapter.exists(".git/config")) ? await app.vault.adapter.read(".git/config") : null;
  const { level, message } = backup.backupStatus(config, app.plugins.enabledPlugins.has("obsidian-git"));
  new obsidian.Notice(message, level === "warn" ? 0 : 5000);
};
