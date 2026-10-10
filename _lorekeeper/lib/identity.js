// Who you are in a shared campaign, per device: Obsidian's local storage for in-Obsidian scripts, plus a line in
// ~/.config/lorekeeper/me.tsv so the note box outside Obsidian knows too. fs, os, path and party are passed in.

const KEY = "lorekeeper-me";

const me = (app) => app.loadLocalStorage(KEY) ?? "";

// Returns "" or a warning when the file couldn't be updated (the in-Obsidian choice applies either way).
async function setMe(app, name, { fs, os, path, desktop, party }) {
  app.saveLocalStorage(KEY, name || null);
  if (!desktop || !fs) return "";
  try {
    const dir = path.join(os.homedir(), ".config", "lorekeeper");
    const file = path.join(dir, "me.tsv");
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, party.tsvWith(text, app.vault.adapter.basePath, name));
    return "";
  } catch (e) {
    return e.message;
  }
}

module.exports = { KEY, me, setMe };
