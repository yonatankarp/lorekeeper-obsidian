// QuickAdd: Refresh from D&D Beyond. Reads the open PC page's character again, say after a level up.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  const templater = app.plugins.plugins["templater-obsidian"]?.templater;
  if (!templater) return new obsidian.Notice("Refresh needs the Templater plugin turned on.");
  const file = app.workspace.getActiveFile();
  const id = file?.path.startsWith("PCs/") ? lk.dndbeyond.sheetId(lk.pcsync.frontmatterValue(await app.vault.read(file), "dndbeyond")) : "";
  if (!id) return new obsidian.Notice("Open a PC page with a D&D Beyond link first.");
  try {
    const token = await lk.pcsync.token(app, obsidian.requestUrl, lk.dndbeyond);
    let res;
    try {
      res = await obsidian.requestUrl({
        url: `https://character-service.dndbeyond.com/character/v5/character/${id}`,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        throw: false,
      });
    } catch {
      throw new Error(lk.dndbeyond.MESSAGES.unreachable);
    }
    let json = null;
    try {
      json = res.json; // a getter that throws on a non-JSON body
    } catch {}
    if (res.status < 200 || res.status >= 300) throw new Error(lk.dndbeyond.characterError(res.status, json, id));
    const c = lk.dndbeyond.parseCharacter(Number(id), json);
    const notes = await lk.pcsync.pcNotes(app);
    const done = await lk.pcsync.syncCharacter(app, { request: obsidian.requestUrl, lk, templater, notes }, c);
    new obsidian.Notice(done.portraitError ? `Refreshed ${c.name}. ${done.portraitError}` : `Refreshed ${c.name}.`, done.portraitError ? 8000 : 5000);
  } catch (e) {
    new obsidian.Notice(e.message, 8000);
  }
};
