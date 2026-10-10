// Writes lorekeeper.json: every file a release ships (lib/update.js categorize), with its SHA-256, plus the plugins it
// turns on. --ref <commit> --version <v> --out <file> builds one for another commit (the v0.1.0 baseline); --check fails
// when lorekeeper.json is stale.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { categorize } = require("../_lorekeeper/lib/update.js");

const ROOT = path.join(__dirname, "..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 1 << 28 });

function buildManifest({ version, files }) {
  const out = { version, plugins: [], files: {} };
  for (const { path: p, text } of files) {
    const kind = categorize(p);
    if (!kind) continue;
    out.files[p] = { sha256: createHash("sha256").update(text).digest("hex"), kind };
    if (p === ".obsidian/community-plugins.json") out.plugins = JSON.parse(text.toString());
  }
  out.files = Object.fromEntries(Object.entries(out.files).sort(([a], [b]) => (a < b ? -1 : 1)));
  return out;
}

function filesAt(ref) {
  const list = ref ? git("ls-tree", "-r", "--name-only", ref) : git("ls-files");
  return list.toString().split("\n").filter(Boolean).filter((p) => categorize(p))
    .map((p) => ({ path: p, text: ref ? git("show", `${ref}:${p}`) : fs.readFileSync(path.join(ROOT, p)) }));
}

module.exports = { buildManifest };

if (require.main === module) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };
  const ref = arg("--ref");
  const version = arg("--version") ?? require("../package.json").version;
  const json = JSON.stringify(buildManifest({ version, files: filesAt(ref) }), null, 2) + "\n";
  const out = arg("--out") ?? path.join(ROOT, "lorekeeper.json");
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== json) {
      console.error("lorekeeper.json is out of date: run npm run make:manifest");
      process.exit(1);
    }
  } else fs.writeFileSync(out, json);
}
