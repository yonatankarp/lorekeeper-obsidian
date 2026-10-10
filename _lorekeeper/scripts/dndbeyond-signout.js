// QuickAdd: Sign out of D&D Beyond. Removes the stored sign-in cookie from Obsidian's secret storage.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  lk.signin.signOut(app.secretStorage);
  new obsidian.Notice("Signed out of D&D Beyond.");
};
