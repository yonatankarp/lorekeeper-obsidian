// Sessions: Sessions/Session N.md, the current one being the highest N. Quick notes are "- HH:MM text" lines appended
// at the end. Used by the QuickAdd scripts through load.js; _lorekeeper/capture/lk-note does the same in sh.

const TEMPLATE = "_lorekeeper/templates/session.md";
const QUIET_MS = 12 * 3600 * 1000;

const sessionPath = (n) => `Sessions/Session ${n}.md`;

function latestSession(names) {
  let latest = 0;
  for (const name of names) {
    const m = name.match(/^Session (\d+)(\.md)?$/);
    if (m) latest = Math.max(latest, Number(m[1]));
  }
  return latest;
}

const isQuiet = (mtimeMs, nowMs) => nowMs - mtimeMs > QUIET_MS;

const two = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const clock = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;

function noteLine(text, now) {
  const clean = text.split(/\s+/).filter(Boolean).join(" ");
  return clean ? `- ${clock(now)} ${clean}` : null;
}

const appendLine = (content, line) => `${content}${content && !content.endsWith("\n") ? "\n" : ""}${line}\n`;

const renderSession = (template, n, date) => template.replaceAll("{{session}}", String(n)).replaceAll("{{date}}", date);

async function currentSession(io, nowMs) {
  const n = latestSession(await io.list("Sessions"));
  if (n === 0) return { n: 0, path: null, quiet: false };
  const path = sessionPath(n);
  const quiet = (await io.exists(path)) && isQuiet(await io.mtimeMs(path), nowMs);
  return { n, path, quiet };
}

async function startSession(io, n, now) {
  const path = sessionPath(n);
  if (!(await io.exists(path))) await io.write(path, renderSession(await io.read(TEMPLATE), n, isoDate(now)));
  return path;
}

async function addNote(io, path, text, now) {
  const line = noteLine(text, now);
  if (line) await io.write(path, appendLine(await io.read(path), line));
  return line;
}

// Party mode: your own file in a shared session. `party` (lib/party.js) is passed in by the caller.
const PART_TEMPLATE = "_lorekeeper/templates/session-part.md";

const ensureSession = startSession;

async function startPart(io, party, n, name, now, { privateFile = false } = {}) {
  await startSession(io, n, now);
  const path = privateFile ? party.privateSessionPath(n, name) : party.partPath(n, name);
  if (!(await io.exists(path))) {
    const author = name === party.DM ? party.DM : `"[[${name}]]"`;
    const text = renderSession(await io.read(PART_TEMPLATE), n, isoDate(now)).replaceAll("{{author}}", author);
    await io.write(path, text);
  }
  return path;
}

// When each file in Session N/ was last written: yours, and your teammates'. A session with only the page (written
// before party play) counts as one teammate's file.
async function partMtimes(io, party, n, name) {
  const dir = `Sessions/Session ${n}`;
  const mine = party.partPath(n, name);
  let mineMtime = null;
  const othersMtimes = [];
  for (const file of await io.list(dir)) {
    if (!file.endsWith(".md")) continue;
    const p = `${dir}/${file}`;
    if (p === mine) mineMtime = await io.mtimeMs(p);
    else othersMtimes.push(await io.mtimeMs(p));
  }
  const page = sessionPath(n);
  if (mineMtime == null && !othersMtimes.length && (await io.exists(page))) othersMtimes.push(await io.mtimeMs(page));
  return { mine: mineMtime, others: othersMtimes };
}

async function currentParty(io, party, name, nowMs) {
  const n = latestSession(await io.list("Sessions"));
  if (n === 0) return { n: 0, path: null, quiet: false };
  const { mine, others } = await partMtimes(io, party, n, name);
  return { n, path: party.partPath(n, name), quiet: party.quietParty({ mineMtime: mine, othersMtimes: others, nowMs }) };
}

async function newSessionNumber(io, party, name, nowMs) {
  const n = latestSession(await io.list("Sessions"));
  if (n === 0) return 1;
  const { mine, others } = await partMtimes(io, party, n, name);
  return party.joinOrNext({ n, mine: mine != null, others, nowMs });
}

module.exports = {
  PART_TEMPLATE, ensureSession, startPart, currentParty, newSessionNumber,
  TEMPLATE, sessionPath, latestSession, isQuiet, isoDate, clock, noteLine, appendLine, renderSession,
  currentSession, startSession, addNote,
};
