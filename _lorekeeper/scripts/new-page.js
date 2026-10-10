// QuickAdd: New page. Asks what you're making (a file in Templates/) and its name, then has Templater make the page
// in that kind's folder and opens it.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { pages, io } = await m.exports(app);
  const templater = app.plugins.plugins["templater-obsidian"]?.templater;
  if (!templater) return new obsidian.Notice("New page needs the Templater plugin turned on.");
  const asked = (promise) => promise.catch(() => null); // QuickAdd rejects on Esc
  const kinds = pages.kinds(await io.list("Templates"));
  const kind = await asked(quickAddApi.suggester(kinds, kinds));
  if (!kind) return;
  const existing = app.vault.getMarkdownFiles().map((f) => f.basename);
  let name;
  for (;;) {
    name = (await asked(quickAddApi.inputPrompt(`New ${kind}`, "Name")))?.trim();
    if (!name) return;
    const problem = pages.nameProblem(name, existing);
    if (!problem) break;
    new obsidian.Notice(problem);
  }
  const folders = app.vault.getRoot().children.filter((f) => "children" in f).map((f) => f.name);
  const folder = pages.folderFor(kind, folders);
  if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  await templater.create_new_note_from_template(
    app.vault.getAbstractFileByPath(`Templates/${kind}.md`),
    folder ? app.vault.getAbstractFileByPath(folder) : app.vault.getRoot(),
    name,
    true,
  );
};
