// QuickAdd: Quick note. Opens the current session, or your own file in it in a shared campaign (offering the next when it went quiet), adds a "- HH:MM " line at
// the end and puts the cursor on it, so Obsidian's [[ suggestions work while typing.
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, party, identity, io } = await m.exports(app);
  const now = new Date();
  const name = identity.me(app); // empty = solo: Sessions/Session N.md; a name = your own file in Session N/
  const current = name ? await session.currentParty(io, party, name, now.getTime()) : await session.currentSession(io, now.getTime());
  let n = current.n || 1;
  if (current.quiet) {
    const next = await quickAddApi
      .yesNoPrompt(`Start Session ${n + 1}?`, `Session ${n} went quiet over 12 hours ago.`)
      .catch(() => false);
    if (next) n += 1;
  }
  const path = name ? await session.startPart(io, party, n, name, now) : await session.startSession(io, n, now);
  const prefix = `- ${session.clock(now)} `;
  const open = app.workspace.getLeavesOfType("markdown").find((l) => l.view.file?.path === path);
  if (open) {
    // Already open, maybe with unsaved typing: add the line through the editor, never through the file on disk.
    app.workspace.setActiveLeaf(open, { focus: true });
    const state = open.getViewState();
    if (state.state?.mode !== "source" || state.state?.source === false)
      await open.setViewState({ ...state, state: { ...state.state, mode: "source", source: true } });
    const editor = open.view.editor;
    const last = editor.lastLine();
    const needsNewline = editor.getLine(last) !== "";
    editor.replaceRange((needsNewline ? "\n" : "") + prefix, { line: last, ch: editor.getLine(last).length });
    const end = editor.lastLine();
    editor.setCursor({ line: end, ch: editor.getLine(end).length });
    editor.focus();
    return;
  }
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
