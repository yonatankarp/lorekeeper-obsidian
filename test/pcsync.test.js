const { test } = require("node:test");
const assert = require("node:assert/strict");
const dndbeyond = require("../_lorekeeper/lib/dndbeyond.js");
const pcpage = require("../_lorekeeper/lib/pcpage.js");
const sync = require("../_lorekeeper/lib/pcsync.js");

const lk = { dndbeyond, pcpage };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const buf = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const COOKIE = "cobalt-SECRET-cookie-value-123";

const c = { id: 5, name: "Demus", race: "Hill Dwarf", classes: "Fighter (Champion)", level: 4, player: "demus_player",
  url: "https://www.dndbeyond.com/characters/5", background: "Folk Hero", alignment: "", appearance: "Age 52",
  personality: "**Ideals:** Family.", portrait: "https://www.dndbeyond.com/avatars/demus.jpg" };

function fakeApp({ secret, files: initial = {}, fm: initialFm = {}, folders: initialFolders = [] } = {}) {
  const files = new Map(Object.entries(initial));
  const fms = new Map(Object.entries(initialFm));
  const folders = new Set(initialFolders);
  const log = { folders: [], binaries: [] };
  const abstract = (p) => {
    if (folders.has(p)) return { path: p, children: [] };
    if (!files.has(p)) return null;
    const name = p.split("/").pop();
    const dot = name.lastIndexOf(".");
    return { path: p, basename: name.slice(0, dot), extension: name.slice(dot + 1) };
  };
  const app = {
    vault: {
      getAbstractFileByPath: abstract,
      getMarkdownFiles: () => [...files.keys()].filter((p) => p.endsWith(".md")).map(abstract),
      createFolder: async (p) => { folders.add(p); log.folders.push(p); },
      createBinary: async (p, data) => { files.set(p, data); log.binaries.push([p, data]); },
      process: async (f, fn) => { files.set(f.path, fn(files.get(f.path))); },
    },
    fileManager: {
      processFrontMatter: async (f, fn) => { if (!fms.has(f.path)) fms.set(f.path, {}); fn(fms.get(f.path)); },
    },
    metadataCache: { getFileCache: (f) => (fms.has(f.path) ? { frontmatter: fms.get(f.path) } : null) },
  };
  if (secret !== undefined) app.secretStorage = { getSecret: (id) => (id === "lorekeeper-dndbeyond" ? secret : null) };
  return { app, files, fms, folders, log };
}

function fakeRequest(handler) {
  const calls = [];
  const request = async (opts) => { calls.push(opts); return handler(opts); };
  request.calls = calls;
  return request;
}
const image = (u8 = JPEG) => ({ status: 200, arrayBuffer: buf(u8) });

test("token: empty without a secret, no request", async () => {
  const request = fakeRequest(() => assert.fail("no request"));
  assert.equal(await sync.token(fakeApp().app, request, dndbeyond), "");
  assert.equal(await sync.token(fakeApp({ secret: "" }).app, request, dndbeyond), "");
  assert.equal(request.calls.length, 0);
});

test("token: posts the cookie to the auth service only, returns the token", async () => {
  const request = fakeRequest(() => ({ status: 200, json: { token: "tok" } }));
  assert.equal(await sync.token(fakeApp({ secret: COOKIE }).app, request, dndbeyond), "tok");
  assert.equal(request.calls.length, 1);
  const call = request.calls[0];
  assert.equal(call.url, "https://auth-service.dndbeyond.com/v1/cobalt-token");
  assert.equal(call.method, "POST");
  assert.equal(call.headers.Cookie, `CobaltSession=${COOKIE}`);
  assert.equal(call.throw, false);
});

test("token: throws the expired message on 401, never containing the cookie", async () => {
  const request = fakeRequest(() => ({ status: 401, json: {} }));
  await assert.rejects(sync.token(fakeApp({ secret: COOKIE }).app, request, dndbeyond), (e) => {
    assert.equal(e.message, dndbeyond.MESSAGES.expired);
    assert.ok(!e.message.includes(COOKIE));
    return true;
  });
  const boom = fakeRequest(() => ({ status: 500, json: {} }));
  await assert.rejects(sync.token(fakeApp({ secret: COOKIE }).app, boom, dndbeyond), (e) => !e.message.includes(COOKIE));
});

test("savePortrait: unique names in Attachments, made when missing", async () => {
  const { app, files, log } = fakeApp();
  const request = fakeRequest(() => image());
  const url = "https://www.dndbeyond.com/avatars/a.jpg";
  assert.equal(await sync.savePortrait(app, request, dndbeyond, url, "Demus"), "Demus.jpg");
  assert.deepEqual(log.folders, ["Attachments"]);
  assert.equal(await sync.savePortrait(app, request, dndbeyond, url, "Demus"), "Demus 2.jpg");
  assert.equal(await sync.savePortrait(app, request, dndbeyond, url, "Demus"), "Demus 3.jpg");
  assert.ok(files.has("Attachments/Demus.jpg") && files.has("Attachments/Demus 2.jpg"));
  assert.deepEqual(log.folders, ["Attachments"]);
  assert.equal(request.calls[0].url, url);
  assert.equal(request.calls[0].throw, false);
  assert.equal(request.calls[0].headers, undefined);
});

test("savePortrait: no url gives empty, no request", async () => {
  const request = fakeRequest(() => assert.fail("no request"));
  assert.equal(await sync.savePortrait(fakeApp().app, request, dndbeyond, "", "Demus"), "");
});

test("savePortrait refusals", async () => {
  const url = "https://www.dndbeyond.com/avatars/a.jpg";
  const html = new TextEncoder().encode("<html>nope</html>");
  await assert.rejects(sync.savePortrait(fakeApp().app, fakeRequest(() => image(html)), dndbeyond, url, "Demus"),
    { message: "D&D Beyond's portrait isn't a picture Lorekeeper can show." });
  const big = new Uint8Array((10 << 20) + 1);
  big.set(JPEG);
  await assert.rejects(sync.savePortrait(fakeApp().app, fakeRequest(() => image(big)), dndbeyond, url, "Demus"),
    { message: "That portrait is over 10 MB." });
  const request = fakeRequest(() => assert.fail("no request"));
  await assert.rejects(sync.savePortrait(fakeApp().app, request, dndbeyond, "https://evil.example/a.jpg", "Demus"),
    { message: "That portrait isn't on D&D Beyond." });
  await assert.rejects(sync.savePortrait(fakeApp().app, fakeRequest(() => ({ status: 404, arrayBuffer: new ArrayBuffer(0) })), dndbeyond, url, "Demus"),
    { message: "Couldn't download the portrait (404)." });
});

test("pcNotes lists PCs with their dndbeyond link", () => {
  const { app } = fakeApp({
    files: { "PCs/Demus.md": "", "PCs/Vex.md": "", "NPCs/Bob.md": "" },
    fm: { "PCs/Demus.md": { dndbeyond: c.url }, "NPCs/Bob.md": { dndbeyond: "x" } },
  });
  assert.deepEqual(sync.pcNotes(app), [
    { path: "PCs/Demus.md", dndbeyond: c.url },
    { path: "PCs/Vex.md", dndbeyond: "" },
  ]);
});

test("syncCharacter updates an existing page; keeps filled sections; skips a portrait already set", async () => {
  const { app, files, fms } = fakeApp({
    files: { "PCs/Old Demus.md": "## Appearance\n\n## Personality\nAlready here.\n\n## Notes\n" },
    fm: { "PCs/Old Demus.md": { dndbeyond: c.url, portrait: "[[mine.png]]", player: "" } },
  });
  const request = fakeRequest(() => assert.fail("no download"));
  const notes = sync.pcNotes(app);
  const res = await sync.syncCharacter(app, { request, lk, templater: null, notes }, c);
  assert.deepEqual(res, { path: "PCs/Old Demus.md", created: false });
  assert.equal(files.get("PCs/Old Demus.md"), "## Appearance\n\nAge 52\n\n## Personality\nAlready here.\n\n## Notes\n");
  const fm = fms.get("PCs/Old Demus.md");
  assert.equal(fm.race, "Hill Dwarf");
  assert.equal(fm.class, "Fighter (Champion)");
  assert.equal(fm.level, 4);
  assert.equal(fm.player, "demus_player");
  assert.equal(fm.portrait, "[[mine.png]]");
});

test("syncCharacter downloads the portrait when the page has none", async () => {
  const { app, fms } = fakeApp({
    files: { "PCs/Demus.md": "## Notes\n" },
    fm: { "PCs/Demus.md": { dndbeyond: c.url, portrait: "" } },
  });
  const request = fakeRequest(() => image());
  const res = await sync.syncCharacter(app, { request, lk, templater: null, notes: sync.pcNotes(app) }, c);
  assert.deepEqual(res, { path: "PCs/Demus.md", created: false });
  assert.equal(fms.get("PCs/Demus.md").portrait, "[[Demus.jpg]]");
});

test("syncCharacter: a portrait failure still updates the page and is reported", async () => {
  const { app, files, fms } = fakeApp({
    files: { "PCs/Demus.md": "## Notes\n" },
    fm: { "PCs/Demus.md": { dndbeyond: c.url } },
  });
  const request = fakeRequest(() => ({ status: 500, arrayBuffer: new ArrayBuffer(0) }));
  const res = await sync.syncCharacter(app, { request, lk, templater: null, notes: sync.pcNotes(app) }, c);
  assert.equal(res.path, "PCs/Demus.md");
  assert.equal(res.created, false);
  assert.equal(res.portraitError, "Couldn't download the portrait (500).");
  assert.equal(fms.get("PCs/Demus.md").race, "Hill Dwarf");
  assert.ok(!("portrait" in fms.get("PCs/Demus.md")) || !fms.get("PCs/Demus.md").portrait);
  assert.ok(files.get("PCs/Demus.md").includes("Age 52"));
});

test("syncCharacter with no page makes one from the template through Templater, then updates it", async () => {
  const { app, files, folders, log } = fakeApp({ files: { "Templates/PC.md": "tpl" } });
  const asked = [];
  const templater = {
    create_new_note_from_template: async (tpl, folder, name, open) => {
      asked.push([tpl.path, folder.path, name, open]);
      setTimeout(() => files.set(`${folder.path}/${name}.md`, "## Appearance\n\n## Notes\n"), 150);
    },
  };
  const request = fakeRequest(() => image());
  const vex = { ...c, id: 6, name: "Vex: the [Bold]" };
  const res = await sync.syncCharacter(app, { request, lk, templater, notes: [] }, vex);
  assert.deepEqual(asked, [["Templates/PC.md", "PCs", "Vex the Bold", false]]);
  assert.deepEqual(log.folders.slice(0, 1), ["PCs"]);
  assert.ok(folders.has("PCs"));
  assert.deepEqual(res, { path: "PCs/Vex the Bold.md", created: true });
  assert.ok(files.get("PCs/Vex the Bold.md").includes("Age 52"));
});

test("syncCharacter names a nameless character after its id and fails when the page never shows up", async () => {
  const { app } = fakeApp({ files: { "Templates/PC.md": "tpl" }, folders: ["PCs"] });
  const templater = { create_new_note_from_template: async () => {} };
  await assert.rejects(
    sync.syncCharacter(app, { request: fakeRequest(() => image()), lk, templater, notes: [] }, { ...c, name: "..." }),
    { message: "Couldn't make the page for Character 5." });
});
