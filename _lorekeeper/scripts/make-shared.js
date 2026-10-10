// QuickAdd: Make shared. Moves one of your private pages out of Private/<you>/ so the party can see it.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { party, identity } = await m.exports(app);
  const name = identity.me(app);
  if (!name) return new obsidian.Notice("Pick your character first: Make shared needs to know whose private notes they are.");
  const file = app.workspace.getActiveFile();
  if (!file || file.extension !== "md") return new obsidian.Notice("Open the page you want to share first.");
  const owner = party.privateOwner(file.path);
  if (!owner) return new obsidian.Notice("That page is already shared.");
  if (owner !== name) return new obsidian.Notice(`That's ${owner}'s private page.`);
  const target = party.sharedPath(file.path);
  if (app.vault.getAbstractFileByPath(target)) return new obsidian.Notice(`There's already a shared page called ${file.basename}.`);
  const ok = await quickAddApi.yesNoPrompt(`Share ${file.basename} with the party?`, "Everyone who shares this campaign gets it.").catch(() => false);
  if (!ok) return;
  const dir = target.split("/").slice(0, -1);
  for (let i = 1; i <= dir.length; i++) {
    const folder = dir.slice(0, i).join("/");
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  }
  await app.fileManager.renameFile(file, target);
  new obsidian.Notice(`${file.basename} is now shared.`);
};
