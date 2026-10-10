// session.js's io interface on a real folder, for tests.
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = (root) => ({
  list: async (dir) => fs.readdir(path.join(root, dir)).catch(() => []),
  exists: async (p) => fs.access(path.join(root, p)).then(() => true, () => false),
  read: (p) => fs.readFile(path.join(root, p), "utf8"),
  write: async (p, text) => {
    await fs.mkdir(path.dirname(path.join(root, p)), { recursive: true });
    await fs.writeFile(path.join(root, p), text);
  },
  mtimeMs: async (p) => (await fs.stat(path.join(root, p))).mtimeMs,
});
