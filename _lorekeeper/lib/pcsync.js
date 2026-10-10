// D&D Beyond to Obsidian: writes PC pages and portraits into the vault. Obsidian's app and requestUrl are passed in,
// and the other lib modules arrive through lk, because lib modules have no require.

const SECRET_ID = "lorekeeper-dndbeyond";
const TOKEN_URL = "https://auth-service.dndbeyond.com/v1/cobalt-token";
const MAX_PORTRAIT_BYTES = 10 << 20;

// The only place the CobaltSession cookie is sent. It never goes into an error, a notice or a log.
async function token(app, request, dndbeyond) {
  const cookie = app.secretStorage?.getSecret(SECRET_ID);
  if (!cookie) return "";
  let res;
  try {
    res = await request({ url: TOKEN_URL, method: "POST", headers: { Cookie: `CobaltSession=${cookie}` }, throw: false });
  } catch {
    throw new Error(dndbeyond.MESSAGES.unreachable);
  }
  let json = null;
  try {
    json = res.json; // a getter that throws on a non-JSON body
  } catch {
    json = null;
  }
  return dndbeyond.tokenFrom(res.status, json);
}

async function ensureFolder(app, path) {
  if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
}

async function savePortrait(app, request, dndbeyond, url, stem) {
  if (!url) return "";
  if (!dndbeyond.portraitUrl(url)) throw new Error("That portrait isn't on D&D Beyond.");
  let res;
  try {
    res = await request({ url, throw: false });
  } catch {
    throw new Error(dndbeyond.MESSAGES.unreachable);
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`Couldn't download the portrait (${res.status}).`);
  if (res.arrayBuffer.byteLength > MAX_PORTRAIT_BYTES) throw new Error("That portrait is over 10 MB.");
  const ext = dndbeyond.imageExt(new Uint8Array(res.arrayBuffer));
  if (!ext) throw new Error("D&D Beyond's portrait isn't a picture Lorekeeper can show.");
  await ensureFolder(app, "Attachments");
  let name = `${stem}.${ext}`;
  for (let n = 2; app.vault.getAbstractFileByPath(`Attachments/${name}`); n++) name = `${stem} ${n}.${ext}`;
  await app.vault.createBinary(`Attachments/${name}`, res.arrayBuffer);
  return name;
}

// A key's value from the first frontmatter block of a note's text. The metadata cache lags writes, so the file is read.
function frontmatterValue(text, key) {
  const block = String(text ?? "").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (block === undefined) return "";
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([^\s:][^:]*):(.*)$/);
    if (!m || m[1].trim() !== key) continue;
    const v = m[2].trim();
    return v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.endsWith(v[0]) ? v.slice(1, -1) : v;
  }
  return "";
}

async function pcNotes(app) {
  const notes = [];
  for (const f of app.vault.getMarkdownFiles().filter((f) => f.path.startsWith("PCs/"))) {
    notes.push({ path: f.path, dndbeyond: frontmatterValue(await app.vault.read(f), "dndbeyond") });
  }
  return notes;
}

// Templater creates the file, and the vault's index can lag behind it.
async function fileAt(app, path) {
  for (let waited = 0; ; waited += 100) {
    const file = app.vault.getAbstractFileByPath(path);
    if (file || waited >= 2000) return file;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function createPage(app, templater, lk, c) {
  const template = app.vault.getAbstractFileByPath("Templates/PC.md");
  if (!template) throw new Error("Couldn't find Templates/PC.md.");
  await ensureFolder(app, "PCs");
  const folder = app.vault.getAbstractFileByPath("PCs");
  const base = lk.pcpage.safePageName(c.name, `Character ${c.id}`);
  let name = base;
  for (let n = 2; app.vault.getAbstractFileByPath(`PCs/${name}.md`); n++) name = `${base} ${n}`;
  await templater.create_new_note_from_template(template, folder, name, false);
  const file = await fileAt(app, `PCs/${name}.md`);
  if (!file) throw new Error(`Couldn't make the page for ${base}.`);
  return file;
}

async function syncCharacter(app, { request, lk, templater, notes }, c) {
  const existing = lk.pcpage.pcPageFor(c, notes);
  const file = existing ? app.vault.getAbstractFileByPath(existing) : await createPage(app, templater, lk, c);
  const created = !existing;
  if (!file) throw new Error(`Couldn't find the page ${existing}.`);
  const current = frontmatterValue(await app.vault.read(file), "portrait");
  let portrait = "";
  let portraitError;
  if (!String(current ?? "").trim() && c.portrait) {
    try {
      portrait = await savePortrait(app, request, lk.dndbeyond, c.portrait, file.basename);
    } catch (e) {
      portraitError = e.message;
    }
  }
  await app.vault.process(file, (md) => lk.pcpage.fillSection(lk.pcpage.fillSection(md, "Appearance", c.appearance), "Personality", c.personality));
  await app.fileManager.processFrontMatter(file, (fm) => lk.pcpage.applyCharacter(fm, c, portrait ? `[[${portrait}]]` : ""));
  return portraitError ? { path: file.path, created, portraitError } : { path: file.path, created };
}

module.exports = { SECRET_ID, token, savePortrait, syncCharacter, pcNotes, frontmatterValue };
