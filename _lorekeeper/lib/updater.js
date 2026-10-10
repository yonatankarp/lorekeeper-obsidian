// The Update command's work, with Obsidian's pieces passed in (adapter, requestUrl, crypto.subtle, lib/update.js) so it
// can be tested with fakes: prepare() fetches the latest release and plans; apply() downloads, verifies and writes.

const REPO = "yonatankarp/lorekeeper-obsidian";
const INSTALLED = "_lorekeeper/installed.json";
const MANIFEST = "lorekeeper.json";
const BASELINE = "_lorekeeper/baselines/v0.1.0.json";

async function readJson(adapter, path) {
  return (await adapter.exists(path)) ? JSON.parse(await adapter.read(path)) : null;
}

// What a vault last installed, as planUpdate reads it: { version, plugins, files: {path: sha}, keys: {path: [...]} }. A
// release manifest (the vault's own lorekeeper.json, or the v0.1.0 baseline) has { sha256, kind, keys } per file.
function toInstalled(record) {
  if (!record) return null;
  const entries = Object.entries(record.files ?? {});
  if (!entries.some(([, e]) => e && typeof e === "object")) return record;
  return {
    version: record.version,
    plugins: record.plugins,
    files: Object.fromEntries(entries.map(([p, e]) => [p, e.sha256])),
    keys: Object.fromEntries(entries.filter(([, e]) => e.keys).map(([p, e]) => [p, e.keys])),
  };
}

// x.y.z compared number by number.
function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
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
  // installed.json is written by an update; a clone of v0.2.0 or later ships its release's lorekeeper.json (the updater
  // never writes it); a vault from v0.1.0 has neither, and the baseline records what v0.1.0 shipped.
  const installed = toInstalled(
    (await readJson(adapter, INSTALLED)) ?? (await readJson(adapter, MANIFEST)) ?? (await readJson(adapter, BASELINE)),
  );
  if (installed && compareVersions(installed.version, release.version) >= 0) return { latest: true, version: installed.version };
  const paths = [...new Set([...Object.keys(release.files), ...Object.keys(installed?.files ?? {})])];
  const current = await hashes(adapter, subtle, update, paths, (p) => installed?.keys?.[p] ?? release.files[p]?.keys);
  return { tag, release, installed, plan: update.planUpdate({ installed, current, release }) };
}

async function ensureFolder(adapter, path) {
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir && !(await adapter.exists(dir))) await adapter.mkdir(dir);
}

// A failed file carries the reason the Update command shows next to it.
const failure = (reason) => Object.assign(new Error(reason), { reason });

async function step(reason, work) {
  try {
    return await work();
  } catch {
    throw failure(reason);
  }
}

async function apply({ adapter, request, subtle, update, tag, release, installed, plan }) {
  const written = [];
  const failed = [];
  const fail = (path, e) => failed.push({ path, reason: e.reason ?? "couldn't update" });
  const download = async (p) => {
    const text = await step("couldn't download", async () => (await get(request, update.rawUrl(REPO, tag, p))).text);
    const seen = update.isSharedJson(p) ? await step("download didn't match", () => update.canonical(JSON.parse(text))) : text;
    if ((await update.sha256Hex(seen, subtle)) !== release.files[p].sha256) throw failure("download didn't match");
    return text;
  };
  const parse = (text) => step("isn't valid JSON", () => JSON.parse(text));
  for (const p of [...plan.add, ...plan.replace]) {
    try {
      const text = await download(p);
      const replacing = update.isSharedJson(p) && plan.replace.includes(p) && (await adapter.exists(p));
      let out = text;
      if (replacing) {
        const mine = await adapter.read(p);
        await parse(mine);
        out = update.mergeJson(mine, text);
      }
      await ensureFolder(adapter, p);
      await adapter.write(p, out);
      written.push(p);
    } catch (e) {
      fail(p, e);
    }
  }
  for (const p of plan.remove) {
    try {
      await step("couldn't remove", () => adapter.remove(p));
      written.push(p);
    } catch (e) {
      fail(p, e);
    }
  }
  for (const p of plan.merge) {
    try {
      const theirs = await download(p);
      const mineText = (await adapter.exists(p)) ? await adapter.read(p) : null;
      const mine = mineText === null ? null : await parse(mineText);
      const merged = !mine ? JSON.parse(theirs)
        : p.endsWith("community-plugins.json") ? update.mergeEnabledPlugins(mine, installed?.plugins ?? [], release.plugins)
        : p.endsWith("hotkeys.json") ? update.mergeHotkeys(mine, JSON.parse(theirs))
        : update.mergeQuickAdd(mine, JSON.parse(theirs));
      const out = JSON.stringify(merged, null, 2) + "\n";
      if (out === mineText) continue;
      await ensureFolder(adapter, p);
      await adapter.write(p, out);
      written.push(p);
    } catch (e) {
      fail(p, e);
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

module.exports = { REPO, toInstalled, compareVersions, prepare, apply };
