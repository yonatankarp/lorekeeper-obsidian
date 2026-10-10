// QuickAdd: Cheat sheet. Opens Cheat Sheet.md.
module.exports = async ({ app, obsidian }) => {
  const file = app.vault.getAbstractFileByPath("Cheat Sheet.md");
  if (!file) return new obsidian.Notice("Cheat Sheet.md is missing from the vault.");
  await app.workspace.getLeaf(false).openFile(file);
};
