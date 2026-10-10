// The view at the top of every session page (dv.view, see _lorekeeper/templates/session.md): open quests, then the
// session's notes as a Timeline or a Journal. Reads Session N.md and any per-author files in Session N/.
const m = { exports: {} };
new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
const { notes, coins, io } = await m.exports(app);

const file = input.file;
const parts = [{ author: "", text: await io.read(file) }];
const folder = file.replace(/\.md$/, "");
for (const name of (await io.list(folder)).filter((n) => n.endsWith(".md")).sort())
  parts.push({ author: name.slice(0, -3), text: await io.read(`${folder}/${name}`) });
const all = notes.merge(parts);

const root = dv.el("div", "", { cls: "lk-session-view" });
const title = dv.page(file)?.title;
if (title) dv.el("div", String(title), { container: root, cls: "lk-session-title" });

const quests = dv.pages('"Quests"').where((p) => p.status === "open" || p.status === "in progress");
if (quests.length) {
  const box = dv.el("div", "", { container: root, cls: "lk-open-quests" });
  dv.el("div", "Open quests", { container: box, cls: "lk-rubric" });
  for (const q of quests) {
    const reward = q.reward ? ` · ${coins.coinsHtml(String(q.reward))}` : "";
    const status = q.status === "in progress" ? " · in progress" : "";
    dv.el("div", `${q.file.link}${status}${reward}`, { container: box, cls: "lk-quest" });
  }
}

if (!all.length) {
  dv.el("p", "No notes yet. Press ⌘⌥N (Ctrl+Alt+N) during the game, or type `- ` lines under Notes.", { container: root, cls: "lk-empty" });
} else {
  const tabs = dv.el("div", "", { container: root, cls: "lk-tabs" });
  const timeline = dv.el("div", "", { container: root, cls: "lk-timeline" });
  const journal = dv.el("div", "", { container: root, cls: "lk-journal" });
  const line = (n) =>
    `${n.time ? `<span class="lk-time">${n.time}</span> ` : ""}${n.text}${n.author ? ` <span class="lk-author">${n.author}</span>` : ""}`;
  for (const n of all) dv.el("div", line(n), { container: timeline, cls: `lk-note lk-kind-${n.kind}` });
  for (const [kind, label] of notes.SECTIONS) {
    const items = all.filter((n) => n.kind === kind);
    if (!items.length) continue;
    dv.el("div", label, { container: journal, cls: `lk-rubric lk-kind-${kind}` });
    for (const n of items) dv.el("div", line(n), { container: journal, cls: `lk-note lk-kind-${kind}` });
  }
  let mode = "timeline";
  try { mode = localStorage.getItem("lorekeeper-session-view") || mode; } catch {}
  const buttons = {};
  const show = (which) => {
    mode = which;
    timeline.hidden = which !== "timeline";
    journal.hidden = which !== "journal";
    for (const [k, b] of Object.entries(buttons)) b.toggleClass("is-active", k === which);
    try { localStorage.setItem("lorekeeper-session-view", which); } catch {}
  };
  for (const [k, label] of [["timeline", "Timeline"], ["journal", "Journal"]]) {
    buttons[k] = tabs.createEl("button", { text: label });
    buttons[k].addEventListener("click", () => show(k));
  }
  show(mode);
}
