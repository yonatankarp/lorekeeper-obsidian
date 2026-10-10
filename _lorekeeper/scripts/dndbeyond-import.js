// QuickAdd: Import from D&D Beyond. Asks for a character link, offers the character and its party, and has each ticked
// one fill or make its page in PCs/. Public characters need no sign-in.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  const templater = app.plugins.plugins["templater-obsidian"]?.templater;
  if (!templater) return new obsidian.Notice("Import needs the Templater plugin turned on.");
  const asked = (promise) => promise.catch(() => null); // QuickAdd rejects on Esc
  const link = (await asked(quickAddApi.inputPrompt("Import from D&D Beyond", "Paste a character link or its number")))?.trim();
  if (!link) return;
  const getJson = (url, headers) =>
    obsidian.requestUrl({ url, headers, throw: false }).then((r) => {
      let json = null;
      try {
        json = r.json; // a getter that throws on a non-JSON body
      } catch {}
      return { status: r.status, json };
    });
  let found;
  try {
    const token = await lk.pcsync.token(app, obsidian.requestUrl, lk.dndbeyond);
    found = await lk.dndbeyond.lookup(link, { getJson, token });
  } catch (e) {
    return new obsidian.Notice(e.message, 8000);
  }
  const labels = found.map((c) => (c.error ? `${c.name}: ${c.error}` : c.name));
  const ticked = await asked(quickAddApi.checkboxPrompt(labels, labels.filter((_, i) => !found[i].error)));
  if (!ticked) return;
  let imported = 0;
  const problems = [];
  for (let i = 0; i < found.length; i++) {
    if (!ticked.includes(labels[i])) continue;
    if (found[i].error) {
      problems.push(labels[i]);
      continue;
    }
    try {
      const notes = await lk.pcsync.pcNotes(app);
      const done = await lk.pcsync.syncCharacter(app, { request: obsidian.requestUrl, lk, templater, notes }, found[i]);
      imported++;
      if (done.portraitError) problems.push(`${found[i].name}: ${done.portraitError}`);
    } catch (e) {
      problems.push(`${found[i].name}: ${e.message}`);
    }
  }
  const summary = `Imported ${imported} character${imported === 1 ? "" : "s"}.`;
  new obsidian.Notice(problems.length ? `${summary}\n${problems.join("\n")}` : summary, problems.length ? 10000 : 5000);
};
