// Backups with Obsidian Git: is this vault ready, and is it about to push a campaign to the public template?

function originUrl(gitConfig) {
  let inOrigin = false;
  for (const line of gitConfig.split(/\r?\n/)) {
    const section = line.match(/^\s*\[(.+)\]\s*$/);
    if (section) inOrigin = section[1].trim() === 'remote "origin"';
    else if (inOrigin) {
      const url = line.match(/^\s*url\s*=\s*(.+?)\s*$/);
      if (url) return url[1];
    }
  }
  return "";
}

const isTemplateRepo = (url) => /github\.com[:/]yonatankarp\/lorekeeper-obsidian(\.git)?\/?$/i.test(url);

function backupStatus(gitConfig, pluginOn) {
  if (gitConfig === null) return { level: "warn", message: "No backup yet: this vault isn't a git repository. See docs/BACKUP.md." };
  const url = originUrl(gitConfig);
  if (!url) return { level: "warn", message: "This vault has no origin repository to back up to. See docs/BACKUP.md, step 2." };
  if (isTemplateRepo(url))
    return { level: "warn", message: "This vault still points at the public Lorekeeper template. Point it at your own private repository before turning on Obsidian Git (docs/BACKUP.md, step 2)." };
  if (!pluginOn) return { level: "warn", message: `Ready to back up to ${url}: turn on Git in Settings > Community plugins.` };
  return { level: "ok", message: `Backing up to ${url}.` };
}

module.exports = { originUrl, isTemplateRepo, backupStatus };
