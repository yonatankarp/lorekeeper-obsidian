// QuickAdd: Quick note. Opens the current session (offering the next when it went quiet), adds a "- HH:MM " line at
// the end and puts the cursor on it, so Obsidian's [[ suggestions work while typing.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, io } = await m.exports(app);
  const now = new Date();
  const current = await session.currentSession(io, now.getTime());
  let n = current.n || 1;
  if (current.quiet) {
    const next = await quickAddApi
      .yesNoPrompt(`Start Session ${n + 1}?`, `Session ${n} went quiet over 12 hours ago.`)
      .catch(() => false);
    if (next) n += 1;
  }
  const path = await session.startSession(io, n, now);
  const prefix = `- ${session.clock(now)} `;
  await io.write(path, session.appendLine(await io.read(path), prefix));
  const fileAt = async (p) => { for (let i = 0; i < 20; i++) { const f = app.vault.getAbstractFileByPath(p); if (f) return f; await new Promise((r) => setTimeout(r, 100)); } return null; };
  const file = await fileAt(path);
  if (!file) return new obsidian.Notice(`Couldn't open ${path}. Try again in a moment.`);
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file, { state: { mode: "source" } });
  const editor = leaf.view.editor;
  const line = editor.lastLine() - 1; // appendLine ends with a newline
  editor.setCursor({ line, ch: editor.getLine(line).length });
  editor.focus();
};
