// QuickAdd: Refresh from D&D Beyond. Reads the open PC page's character again, say after a level up.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  try {
    const file = app.workspace.getActiveFile();
    const link = file?.path.startsWith("PCs/") ? lk.pcsync.frontmatterValue(await app.vault.read(file), "dndbeyond") : "";
    const id = lk.dndbeyond.sheetId(link);
    if (!id) return new obsidian.Notice("Open a PC page with a D&D Beyond link first.");
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
    const data = json?.data;
    if (res.status < 200 || res.status >= 300 || !data || typeof data !== "object" || Array.isArray(data))
      throw new Error(lk.dndbeyond.characterError(res.status, json, id));
    const c = lk.dndbeyond.parseCharacter(Number(id), json);
    // The open page is the one to update, so Templater is only needed to make a page, which never happens here.
    const templater = app.plugins?.plugins?.["templater-obsidian"]?.templater;
    const deps = { request: obsidian.requestUrl, lk, notes: [{ path: file.path, dndbeyond: link }], ...(templater ? { templater } : {}) };
    const done = await lk.pcsync.syncCharacter(app, deps, c);
    new obsidian.Notice(done.portraitError ? `Refreshed ${c.name}. ${done.portraitError}` : `Refreshed ${c.name}.`, done.portraitError ? 8000 : 5000);
  } catch (e) {
    new obsidian.Notice(e.message, 8000);
  }
};
