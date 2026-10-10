// QuickAdd: Make line private. Moves the selected lines (or the cursor line) into your private notes for the session
// (Private/<you>/Sessions/Session N.md), taking the page's name along as a link. Shared campaigns only.
module.exports = async ({ app, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const { session, party, identity, io } = await m.exports(app);
  const name = identity.me(app);
  if (!name) return new obsidian.Notice("Pick your character first: Make line private needs to know whose private notes they are.");
  const editor = app.workspace.activeEditor?.editor;
  const file = app.workspace.activeEditor?.file ?? app.workspace.getActiveFile();
  if (!editor || !file || file.extension !== "md") return new obsidian.Notice("Open a note and put the cursor on a line first.");

  if (file.path.startsWith("Private/")) return new obsidian.Notice("This page is already private.");
  const author = (file.path.match(/^Sessions\/Session \d+\/([^/]+)\.md$/) || [])[1];
  if (author && author !== name) return new obsidian.Notice(`That's ${author}'s notes: only they can make them private.`);

  // Selected lines; a selection ending at the start of a line doesn't include that line.
  const sel = editor.listSelections()[0];
  const [a, b] = [sel.anchor, sel.head].sort((x, y) => x.line - y.line || x.ch - y.ch);
  const from = a.line;
  const to = b.line > a.line && b.ch === 0 ? b.line - 1 : b.line;

  if (editor.getLine(0) === "---") {
    let close = 1;
    while (close < editor.lineCount() && editor.getLine(close) !== "---") close++;
    if (close < editor.lineCount() && from <= close) return new obsidian.Notice("The properties at the top of a page can't be made private.");
  }

  const picked = [];
  for (let i = from; i <= to; i++) if (!party.isEmptyNoteLine(editor.getLine(i))) picked.push(i);
  if (!picked.length) return new obsidian.Notice("Nothing to move.");

  const now = new Date();
  let n = party.sessionOf(file.path);
  let page = null;
  if (!n) {
    n = (await session.currentParty(io, party, name, now.getTime())).n || 1;
    page = { name: file.basename, kind: app.metadataCache.getFileCache(file)?.frontmatter?.type ?? "" };
  }
  const copied = picked.map((i) => editor.getLine(i));
  const lines = party.privatizeLines(copied, page);
  try {
    const path = await session.startPart(io, party, n, name, now, { privateFile: true });
    let text = await io.read(path);
    for (const line of lines) text = session.appendLine(text, line);
    await io.write(path, text);
  } catch (e) {
    return new obsidian.Notice(`Couldn't move the notes: ${e.message}`);
  }

  if (picked.some((i, k) => editor.getLine(i) !== copied[k]))
    return new obsidian.Notice("The page changed while moving: your private notes have the lines, delete them from the page yourself.");

  // Only now take them out of the page, from the bottom up so the line numbers hold.
  for (const i of picked.reverse()) {
    const last = i === editor.lineCount() - 1;
    if (last && i > 0) editor.replaceRange("", { line: i - 1, ch: editor.getLine(i - 1).length }, { line: i, ch: editor.getLine(i).length });
    else if (last) editor.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: editor.getLine(0).length });
    else editor.replaceRange("", { line: i, ch: 0 }, { line: i + 1, ch: 0 });
  }
  new obsidian.Notice(`Moved ${lines.length} ${lines.length === 1 ? "note" : "notes"} to your private notes.`);
};
