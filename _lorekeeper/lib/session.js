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

module.exports = {
  TEMPLATE, sessionPath, latestSession, isQuiet, isoDate, clock, noteLine, appendLine, renderSession,
  currentSession, startSession, addNote,
};
