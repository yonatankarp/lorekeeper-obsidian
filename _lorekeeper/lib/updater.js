// The Update command's work, with Obsidian's pieces passed in (adapter, requestUrl, crypto.subtle, lib/update.js) so it
// can be tested with fakes: prepare() fetches the latest release and plans; apply() downloads, verifies and writes.

const REPO = "yonatankarp/lorekeeper-obsidian";
const INSTALLED = "_lorekeeper/installed.json";
const BASELINE = "_lorekeeper/baselines/v0.1.0.json";

async function readJson(adapter, path) {
  return (await adapter.exists(path)) ? JSON.parse(await adapter.read(path)) : null;
}

async function get(request, url) {
  const res = await request({ url, throw: false });
  if (res.status < 200 || res.status >= 300) throw new Error(`Couldn't download ${url} (${res.status}).`);
  return res;
}

// Shared settings files are hashed over the keys the template ships (so Obsidian's own additions don't count as edits);
// everything else, and JSON that doesn't parse, over its raw text.
async function hashes(adapter, subtle, update, paths, keysFor) {
  const out = {};
  for (const p of paths) {
    if (!(await adapter.exists(p))) continue;
    const text = await adapter.read(p);
    let view = text;
    if (update.isSharedJson(p)) {
      try { view = update.jsonView(text, keysFor(p)); } catch { view = text; }
    }
    out[p] = await update.sha256Hex(view, subtle);
  }
  return out;
}

async function prepare({ adapter, request, subtle, update }) {
  const tag = (await get(request, `https://api.github.com/repos/${REPO}/releases/latest`)).json.tag_name;
  const release = (await get(request, update.rawUrl(REPO, tag, "lorekeeper.json"))).json;
  const installed = (await readJson(adapter, INSTALLED)) ?? (await readJson(adapter, BASELINE));
  if (installed?.version === release.version) return { latest: true, version: release.version };
  const paths = [...new Set([...Object.keys(release.files), ...Object.keys(installed?.files ?? {})])];
  const current = await hashes(adapter, subtle, update, paths, (p) => installed?.keys?.[p] ?? release.files[p]?.keys);
  return { tag, release, installed, plan: update.planUpdate({ installed, current, release }) };
}

async function ensureFolder(adapter, path) {
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir && !(await adapter.exists(dir))) await adapter.mkdir(dir);
}

async function apply({ adapter, request, subtle, update, tag, release, installed, plan }) {
  const written = [];
  const failed = [];
  for (const p of [...plan.add, ...plan.replace]) {
    try {
      const text = (await get(request, update.rawUrl(REPO, tag, p))).text;
      const shared = update.isSharedJson(p);
      const seen = shared ? update.canonical(JSON.parse(text)) : text;
      if ((await update.sha256Hex(seen, subtle)) !== release.files[p].sha256) throw new Error("hash mismatch");
      await ensureFolder(adapter, p);
      const replacing = shared && plan.replace.includes(p) && (await adapter.exists(p));
      await adapter.write(p, replacing ? update.mergeJson(await adapter.read(p), text) : text);
      written.push(p);
    } catch {
      failed.push(p);
    }
  }
  for (const p of plan.remove) {
    try {
      await adapter.remove(p);
      written.push(p);
    } catch {
      failed.push(p);
    }
  }
  for (const p of plan.merge) {
    try {
      const theirs = (await get(request, update.rawUrl(REPO, tag, p))).text;
      const seen = update.isSharedJson(p) ? update.canonical(JSON.parse(theirs)) : theirs;
      if ((await update.sha256Hex(seen, subtle)) !== release.files[p].sha256) throw new Error("hash mismatch");
      const mineText = (await adapter.exists(p)) ? await adapter.read(p) : null;
      const mine = mineText === null ? null : JSON.parse(mineText);
      const merged = !mine ? JSON.parse(theirs)
        : p.endsWith("community-plugins.json") ? update.mergeEnabledPlugins(mine, installed?.plugins ?? [], release.plugins)
        : update.mergeQuickAdd(mine, JSON.parse(theirs));
      const out = JSON.stringify(merged, null, 2) + "\n";
      if (out === mineText) continue;
      await ensureFolder(adapter, p);
      await adapter.write(p, out);
      written.push(p);
    } catch {
      failed.push(p);
    }
  }
  if (!failed.length) {
    const paths = Object.keys(release.files);
    const files = await hashes(adapter, subtle, update, paths, (p) => release.files[p].keys);
    const keys = Object.fromEntries(paths.filter((p) => update.isSharedJson(p) && release.files[p].keys).map((p) => [p, release.files[p].keys]));
    // A file the player edited stays an edit: keep what the last install recorded (nothing, if it recorded nothing).
    for (const p of plan.kept) {
      const was = installed?.files?.[p];
      if (was === undefined) delete files[p]; else files[p] = was;
      const wasKeys = installed?.keys?.[p];
      if (wasKeys === undefined) delete keys[p]; else keys[p] = wasKeys;
    }
    await adapter.write(INSTALLED, JSON.stringify({ version: release.version, plugins: release.plugins, keys, files }, null, 2) + "\n");
  }
  const reload = written.some((p) => p.startsWith(".obsidian/"));
  return { written, failed, reload };
}

module.exports = { REPO, prepare, apply };
