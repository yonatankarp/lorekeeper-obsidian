// QuickAdd: New session. Starts the next session (in a shared campaign, joins the one in play) and opens it.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, party, identity, io } = await m.exports(app);
  const now = new Date();
  const name = identity.me(app);
  let path;
  if (name) {
    // Shared campaign: join the session teammates are writing in, or start the next, and open your own file.
    const n = await session.newSessionNumber(io, party, name, now.getTime());
    path = await session.startPart(io, party, n, name, now);
  } else {
    const { n } = await session.currentSession(io, now.getTime());
    path = await session.startSession(io, n + 1, now);
  }
  const fileAt = async (p) => { for (let i = 0; i < 20; i++) { const f = app.vault.getAbstractFileByPath(p); if (f) return f; await new Promise((r) => setTimeout(r, 100)); } return null; };
  const file = await fileAt(path);
  if (!file) return new obsidian.Notice(`Couldn't open ${path}. Try again in a moment.`);
  await app.workspace.getLeaf(false).openFile(file);
};
