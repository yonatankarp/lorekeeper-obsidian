// QuickAdd: Make private. Moves the open page under Private/<you>/ (links to it follow). Shared campaigns only.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { party, identity } = await m.exports(app);
  const name = identity.me(app);
  if (!name) return new obsidian.Notice("Pick your character first: Make private needs to know whose private notes they are.");
  const file = app.workspace.getActiveFile();
  if (!file || file.extension !== "md") return new obsidian.Notice("Open the page you want to make private first.");
  if (file.path.startsWith("Private/")) return new obsidian.Notice("That page is already private.");
  if (/^(Sessions|Templates|_lorekeeper)\//.test(file.path)) return new obsidian.Notice("Sessions, templates and Lorekeeper's own files can't be made private.");
  const target = party.privatePath(file.path, name);
  if (app.vault.getAbstractFileByPath(target)) return new obsidian.Notice(`There's already a private page called ${file.basename}.`);
  const dir = target.split("/").slice(0, -1);
  for (let i = 1; i <= dir.length; i++) {
    const folder = dir.slice(0, i).join("/");
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  }
  await app.fileManager.renameFile(file, target);
  new obsidian.Notice(`${file.basename} is now private.`);
};
