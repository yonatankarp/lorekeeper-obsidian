// The view at the top of every session page (dv.view, see _lorekeeper/templates/session.md): open quests, then the
// session's notes as a Timeline or a Journal. Reads Session N.md and any per-author files in Session N/.
const m = { exports: {} };
new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
const { notes, coins, io, party, identity } = await m.exports(app);

const file = input.file;
const parts = [{ author: "", text: await io.read(file) }];
const folder = file.replace(/\.md$/, "");
for (const name of (await io.list(folder)).filter((n) => n.endsWith(".md")).sort())
  parts.push({ author: name.slice(0, -3), text: await io.read(`${folder}/${name}`) });

// Party mode: your own private session file (the DM sees every player's). Foreign ones are never read.
const me = identity.me(app);
const privateParts = [];
let foreign = [];
if (me) {
  const n = notes.sessionNumber(file);
  const paths = [];
  for (const owner of (await io.list("Private")).sort()) {
    const p = party.privateSessionPath(n, owner);
    if (await io.exists(p)) paths.push(p);
  }
  const vis = party.visiblePrivate({ me, isDM: me === party.DM, paths });
  foreign = vis.foreign;
  for (const p of vis.show) privateParts.push({ author: party.privateOwner(p), text: await io.read(p) });
}
const all = notes.mergeWithPrivate(parts, privateParts);

// Dataview can run this view twice at once; the newest render wins.
dv.container.querySelectorAll(".lk-session-view").forEach((e) => e.remove());
const root = dv.el("div", "", { cls: "lk-session-view" });
if (foreign.length)
  dv.el("div", "Other players' private notes are on this device: check your sync setup (docs/PARTY.md).", { container: root, cls: "lk-warning" });
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
  const portraits = {};
  const portrait = (author) => {
    if (!author || author === party.DM) return "";
    if (!(author in portraits)) {
      portraits[author] = "";
      const target = notes.portraitTarget(dv.page(`PCs/${author}`)?.portrait);
      const img = target && app.metadataCache.getFirstLinkpathDest(target, `PCs/${author}.md`);
      if (img) portraits[author] = `<img class="lk-portrait" src="${app.vault.getResourcePath(img)}" alt=""> `;
    }
    return portraits[author];
  };
  const line = (n) =>
    `${n.time ? `<span class="lk-time">${n.time}</span> ` : ""}${n.text}${notes.showAuthor(n, me) ? ` <span class="lk-author">${portrait(n.author)}${n.author}</span>` : ""}`;
  const cls = (n, kind) => `lk-note lk-kind-${kind}${n.private ? " lk-private" : ""}`;
  for (const n of all) dv.el("div", line(n), { container: timeline, cls: cls(n, n.kind) });
  for (const [kind, label] of notes.SECTIONS) {
    const items = all.filter((n) => n.kind === kind);
    if (!items.length) continue;
    dv.el("div", label, { container: journal, cls: `lk-rubric lk-kind-${kind}` });
    for (const n of items) dv.el("div", line(n), { container: journal, cls: cls(n, kind) });
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
