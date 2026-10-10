// Party play: who writes where in a shared campaign. Pure rules, no I/O. Your name (a PC page name, or DM) picks your
// own session file and your Private/ folder; solo mode (no name) never calls these.

const DM = "DM";
const QUIET_MS = 12 * 3600 * 1000;
const TEMPLATE = "_lorekeeper/templates/session-part.md";

// me.tsv: one "<absolute vault path>\t<name>" line per vault.
function meFromTsv(text, vaultPath) {
  for (const line of String(text || "").split(/\r?\n/)) {
    const tab = line.indexOf("\t");
    if (tab > 0 && line.slice(0, tab) === vaultPath) return line.slice(tab + 1).trim();
  }
  return "";
}

function tsvWith(text, vaultPath, name) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  const entry = `${vaultPath}\t${name}`;
  const at = lines.findIndex((l) => l.split("\t")[0] === vaultPath);
  if (at < 0) {
    if (name) lines.push(entry);
  } else if (name) lines[at] = entry;
  else lines.splice(at, 1);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

const partPath = (n, name) => `Sessions/Session ${n}/${name}.md`;
const privateSessionPath = (n, name) => `Private/${name}/Sessions/Session ${n}.md`;
const privatePath = (path, name) => `Private/${name}/${path}`;
const sharedPath = (path) => path.replace(/^Private\/[^/]+\//, "");
const privateOwner = (path) => (path.match(/^Private\/([^/]+)\//) || [])[1] || "";

const canPick = (name) => name !== DM;

// A leading ~ marks a note private ("~~" is strikethrough, not private).
function privateNote(text) {
  const m = String(text).match(/^\s*~(?!~)(.*)$/s);
  return m ? { private: true, text: m[1] } : { private: false, text };
}

const fresh = (mtime, nowMs) => nowMs - mtime <= QUIET_MS;

// New session: join N when a teammate wrote in it in the last 12 hours and you haven't; else start N + 1.
function joinOrNext({ n, mine, others, nowMs }) {
  const join = n > 0 && !mine && others.some((t) => fresh(t, nowMs));
  return join ? n : n + 1;
}

function quietParty({ mineMtime, othersMtimes, nowMs }) {
  if (mineMtime != null) return !fresh(mineMtime, nowMs);
  return othersMtimes.every((t) => !fresh(t, nowMs));
}

function takeLines(md, from, to) {
  const all = md.split("\n");
  const lines = all.slice(from, to + 1);
  all.splice(from, to - from + 1);
  return { rest: all.join("\n"), lines };
}

const PRIVATE_LINE = /^(\s*(?:[-*+] )?(?:\d{1,2}:\d{2} )?)~(?!~)\s*(.*)$/;
const PREFIX = /^(\s*(?:[-*+] )?(?:\d{1,2}:\d{2} )?)(.*)$/;

function linksTo(text, name) {
  for (const m of text.matchAll(/\[\[([^\]|#]*)/g)) if (m[1].trim() === name) return true;
  return false;
}

function privatizeLines(lines, page) {
  const link = page ? `${page.kind === "npc" ? "@" : ""}[[${page.name}]] ` : "";
  return lines.map((line) => {
    const m = line.match(PRIVATE_LINE) || line.match(PREFIX);
    const [, head, body] = m;
    return head + (page && !linksTo(body, page.name) ? link : "") + body;
  });
}

function visiblePrivate({ me, isDM, paths }) {
  const show = [];
  const foreign = [];
  for (const path of paths) {
    if (!/^Private\/[^/]+\/Sessions\/Session \d+\.md$/.test(path)) continue;
    if (isDM || privateOwner(path) === me) show.push(path);
    else foreign.push(path);
  }
  return { show, foreign };
}

module.exports = {
  DM, TEMPLATE, meFromTsv, tsvWith, partPath, privateSessionPath, privatePath, sharedPath, privateOwner,
  canPick, privateNote, joinOrNext, quietParty, takeLines, privatizeLines, visiblePrivate,
};
