// QuickAdd: Sign in to D&D Beyond. Keeps the pasted CobaltSession cookie in Obsidian's secret storage, then checks it.
// The cookie is never shown in a notice or an error.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  new obsidian.Notice("Copy CobaltSession from your browser: see docs/DNDBEYOND.md.", 8000);
  const input = await quickAddApi.inputPrompt("Sign in to D&D Beyond", "Paste your CobaltSession cookie").catch(() => null); // Esc
  if (!input) return;
  try {
    lk.signin.signIn(app.secretStorage, input);
  } catch (e) {
    return new obsidian.Notice(e.message);
  }
  try {
    await lk.pcsync.token(app, obsidian.requestUrl, lk.dndbeyond);
    new obsidian.Notice("Signed in to D&D Beyond.");
  } catch (e) {
    lk.signin.signOut(app.secretStorage);
    new obsidian.Notice(e.message, 8000);
  }
};
