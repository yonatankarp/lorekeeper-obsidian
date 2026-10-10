// Updates: which files a release owns (managed), which the player may have edited (shared), and the plan that moves a
// vault to a new release without touching an edit. The Update command (scripts/update.js) does the downloads.

const MANAGED = [
  /^_lorekeeper\/(?!installed\.json$).+/,
  /^\.obsidian\/themes\/.+/,
  /^\.obsidian\/plugins\/[^/]+\/(main\.js|manifest\.json|styles\.css|LICENSE)$/,
  /^CREDITS\.md$/,
  /^docs\/(CAPTURE|BACKUP|DNDBEYOND)\.md$/,
];
const SHARED = [
  /^Templates\/[^/]+\.md$/,
  /^\.obsidian\/plugins\/[^/]+\/data\.json$/,
  /^\.obsidian\/(hotkeys|app|appearance|core-plugins|community-plugins|graph|bookmarks)\.json$/,
  /^Home\.md$/,
  /^Cheat Sheet\.md$/,
];
const MERGED = [".obsidian/community-plugins.json", ".obsidian/plugins/quickadd/data.json"];

function categorize(path) {
  if (path.endsWith("/.gitkeep")) return null;
  if (MANAGED.some((r) => r.test(path))) return "managed";
  if (SHARED.some((r) => r.test(path))) return "shared";
  return null;
}

function planUpdate({ installed, current, release }) {
  const plan = { add: [], replace: [], kept: [], remove: [], merge: [] };
  const was = installed?.files ?? {};
  const edited = (path) => path in current && path in was && current[path] !== was[path];
  for (const path of Object.keys(release.files).sort()) {
    const { sha256, kind } = release.files[path];
    if (MERGED.includes(path)) plan.merge.push(path);
    else if (!(path in current)) {
      if (kind === "managed" || !(path in was)) plan.add.push(path);
      else plan.kept.push(path); // a shared file the player deleted stays deleted
    } else if (current[path] === sha256) continue;
    else if (kind === "managed" || !edited(path)) plan.replace.push(path);
    else plan.kept.push(path);
  }
  for (const path of Object.keys(was).sort()) {
    if (path in release.files || !(path in current)) continue;
    if (categorize(path) === "managed" || !edited(path)) plan.remove.push(path);
    else plan.kept.push(path);
  }
  return plan;
}

function mergeEnabledPlugins(current, installedPlugins, releasePlugins) {
  const added = releasePlugins.filter((id) => !installedPlugins.includes(id) && !current.includes(id));
  return [...current, ...added];
}

function mergeQuickAdd(current, release) {
  const theirs = new Map(release.choices.map((c) => [c.id, c]));
  const choices = current.choices.map((c) => (c.id.startsWith("lk-") && theirs.has(c.id) ? theirs.get(c.id) : c));
  for (const c of release.choices) if (!choices.some((x) => x.id === c.id)) choices.push(c);
  return { ...current, choices, migrations: { ...current.migrations, ...release.migrations } };
}

async function sha256Hex(text, subtle) {
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const rawUrl = (repo, tag, path) =>
  `https://raw.githubusercontent.com/${repo}/${tag}/${path.split("/").map(encodeURIComponent).join("/")}`;

module.exports = { MERGED, categorize, planUpdate, mergeEnabledPlugins, mergeQuickAdd, sha256Hex, rawUrl };
