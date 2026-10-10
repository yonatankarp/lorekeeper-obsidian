<%*
const m = { exports: {} };
new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
const { pages, io } = await m.exports(app);
const kinds = pages.kinds(await io.list("Templates"));
const kind = await tp.system.suggester(["Plain note", ...kinds], ["", ...kinds], false, `What is ${tp.file.title}?`);
if (kind) {
  const folders = app.vault.getRoot().children.filter((f) => "children" in f).map((f) => f.name);
  const folder = pages.folderFor(kind, folders);
  if (folder) {
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    await tp.file.move(`${folder}/${tp.file.title}`);
  }
  tR += await tp.file.include(`[[Templates/${kind}]]`);
}
%>
