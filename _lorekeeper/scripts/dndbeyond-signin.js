// QuickAdd: Sign in to D&D Beyond. Keeps the pasted CobaltSession cookie in Obsidian's secret storage, then checks it.
// A cookie D&D Beyond calls expired is signed out; if it can't be checked, the previous sign-in is kept. The cookie is
// never shown in a notice or an error.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  new obsidian.Notice("Copy CobaltSession from your browser: see docs/DNDBEYOND.md in this vault.", 8000);
  const input = await quickAddApi.inputPrompt("Sign in to D&D Beyond", "Paste your CobaltSession cookie").catch(() => null); // Esc
  if (!input) return;
  const previous = app.secretStorage?.getSecret?.(lk.signin.SECRET_ID) ?? null;
  try {
    lk.signin.signIn(app.secretStorage, input);
  } catch (e) {
    return new obsidian.Notice(e.message);
  }
  let error = null;
  try {
    await lk.pcsync.token(app, obsidian.requestUrl, lk.dndbeyond);
  } catch (e) {
    error = e;
  }
  const after = lk.signin.afterVerify(error, previous, lk.dndbeyond.MESSAGES.expired);
  if (!after) return new obsidian.Notice("Signed in to D&D Beyond.");
  app.secretStorage.setSecret(lk.signin.SECRET_ID, after.keep);
  new obsidian.Notice(after.message, 8000);
};
