// PC pages kept up to date with D&D Beyond, ported from Lorekeeper's src/vault.js (32a07f6, lines 496-554).

const sheetId = (url) => String(url ?? "").match(/^https:\/\/(?:www\.)?dndbeyond\.com\/(?:[^?#]*\/)?characters\/(\d+)/)?.[1] ?? "";
const baseName = (path) => path.split("/").pop().replace(/\.md$/i, "");

function pcPageFor(character, notes) {
  const pcs = notes.filter((n) => n.path.startsWith("PCs/"));
  const id = String(character.id);
  const named = (n) => baseName(n.path).toLowerCase() === character.name.trim().toLowerCase() && [id, ""].includes(sheetId(n.dndbeyond));
  return (pcs.find((n) => sheetId(n.dndbeyond) === id) ?? pcs.find(named))?.path ?? null;
}

function safePageName(name, fallback) {
  const clean = name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+\s*/, "").replace(/[.\s]+$/, "");
  return clean || fallback;
}

function fillSection(md, heading, text) {
  if (!text) return md;
  const nl = md.includes("\r\n") ? "\r\n" : "\n";
  const lines = md.split(nl);
  const block = ["", ...text.split("\n"), ""];
  const at = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (at === -1) {
    const notes = lines.findIndex((l) => /^##\s+notes\s*$/i.test(l));
    if (notes === -1) return `${md.replace(/\s*$/, "")}${nl}${nl}## ${heading}${nl}${block.join(nl)}`;
    lines.splice(notes, 0, `## ${heading}`, ...block);
    return lines.join(nl);
  }
  let end = at + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
  if (lines.slice(at + 1, end).some((l) => l.trim())) return md;
  lines.splice(at + 1, end - at - 1, ...block);
  return lines.join(nl);
}

const blank = (v) => v === undefined || v === null || String(v).trim() === "";

function applyCharacter(fm, c, portraitLink = "") {
  const replace = { race: c.race, class: c.classes, level: c.level || "", background: c.background, alignment: c.alignment, dndbeyond: c.url };
  for (const [k, v] of Object.entries(replace)) if (!blank(v)) fm[k] = v;
  if (!blank(c.player) && blank(fm.player)) fm.player = c.player;
  if (!blank(portraitLink) && blank(fm.portrait)) fm.portrait = portraitLink;
  return fm;
}

module.exports = { pcPageFor, safePageName, fillSection, applyCharacter };
