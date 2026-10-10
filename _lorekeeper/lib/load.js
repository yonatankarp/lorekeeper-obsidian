// Loads _lorekeeper/lib inside Obsidian, where Node's require can't reach the vault (and mobile has none). Each lib
// module is CommonJS with no requires of its own. Entry scripts run this file with new Function and await it with app.

const MODULES = ["notes", "session", "pages", "coins", "update", "updater", "backup", "dndbeyond", "pcpage"];

module.exports = async function lorekeeper(app) {
  const { vault } = app;
  const { adapter } = vault;
  const lk = {};
  for (const name of MODULES) {
    const m = { exports: {} };
    new Function("module", "exports", await adapter.read(`_lorekeeper/lib/${name}.js`))(m, m.exports);
    lk[name] = m.exports;
  }
  lk.io = {
    async list(dir) {
      if (!(await adapter.exists(dir))) return [];
      const { files, folders } = await adapter.list(dir);
      return [...files, ...folders].map((p) => p.split("/").pop());
    },
    exists: (p) => adapter.exists(p),
    read: (p) => adapter.read(p),
    async write(p, text) {
      const file = vault.getAbstractFileByPath(p);
      if (file) return vault.modify(file, text);
      // The vault's index can lag behind disk (lk-note writes outside Obsidian): create would throw on an existing path.
      if (await adapter.exists(p)) return adapter.write(p, text);
      const dir = p.split("/").slice(0, -1).join("/");
      if (dir && !(await adapter.exists(dir))) await vault.createFolder(dir);
      await vault.create(p, text);
    },
    mtimeMs: async (p) => (await adapter.stat(p)).mtime,
  };
  return lk;
};
