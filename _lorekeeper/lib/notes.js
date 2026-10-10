// Session notes: lines like "- 21:43 @Mirela the innkeeper", filed by their first character (Lorekeeper's notes.js).
// Hand-written lines count too, so nothing typed under ## Notes is dropped. Loaded in Obsidian by load.js.

const SECTIONS = [
  ["event", "What happened"],
  ["npc", "NPCs"],
  ["loot", "Loot"],
  ["quest", "Quests"],
  ["mystery", "Mysteries"],
  ["quote", "Quotes"],
];

const PREFIX = { "@": "npc", "#": "loot", "!": "quest", "?": "mystery", '"': "quote", "“": "quote" };

const BULLET = /^[-*+](?: (\d{1,2}:\d{2}))?(?: (.*))?$/;

function body(md) {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? md.slice(m[0].length) : md;
}

function notesOf(md) {
  const out = [];
  let code = false;
  for (const raw of body(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      code = !code;
      continue;
    }
    if (code || /^#{1,6} /.test(line) || /^(-{3,}|\*{3,})$/.test(line)) continue;
    const bullet = line.match(BULLET);
    let text = (bullet ? bullet[2] ?? "" : line).trim();
    if (!text) continue;
    const kind = text.startsWith("![") ? "event" : PREFIX[text[0]] ?? "event"; // ![[map.png]] isn't a "!" quest
    if (kind !== "event" && kind !== "quote") text = text.slice(1).trim(); // quotes keep their marks
    if (text) out.push({ time: bullet?.[1] ?? "", kind, text });
  }
  return out;
}

function journal(notes) {
  const groups = Object.fromEntries(SECTIONS.map(([kind]) => [kind, []]));
  for (const n of notes) groups[n.kind].push(n.text);
  return groups;
}

const minutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// Every part's notes in time order. Within a file, a time earlier than the one before means the game went past
// midnight, and an untimed note sorts with the note before it, so a file's own order never changes.
function merge(parts) {
  const all = [];
  parts.forEach(({ author, text }, p) => {
    let day = 0;
    let last = -1;
    notesOf(text).forEach((n, i) => {
      if (n.time) {
        const t = minutes(n.time);
        if (last >= 0 && t + day * 1440 < last) day += 1;
        last = t + day * 1440;
      }
      all.push({ ...n, author, key: Math.max(last, 0), p, i });
    });
  });
  all.sort((a, b) => a.key - b.key || a.p - b.p || a.i - b.i);
  return all.map(({ time, kind, text, author }) => ({ time, kind, text, author }));
}

module.exports = { SECTIONS, PREFIX, notesOf, journal, merge };
