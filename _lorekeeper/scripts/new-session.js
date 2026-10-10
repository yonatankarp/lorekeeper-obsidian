// QuickAdd: New session. Starts the next session and opens it.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, io } = await m.exports(app);
  const now = new Date();
  const { n } = await session.currentSession(io, now.getTime());
  const path = await session.startSession(io, n + 1, now);
  const fileAt = async (p) => { for (let i = 0; i < 20; i++) { const f = app.vault.getAbstractFileByPath(p); if (f) return f; await new Promise((r) => setTimeout(r, 100)); } return null; };
  const file = await fileAt(path);
  if (!file) return new obsidian.Notice(`Couldn't open ${path}. Try again in a moment.`);
  await app.workspace.getLeaf(false).openFile(file);
};
