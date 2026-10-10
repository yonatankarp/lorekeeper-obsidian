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

const isSharedJson = (path) => path.endsWith(".json") && categorize(path) === "shared";

function planUpdate({ installed, current, release }) {
  const plan = { add: [], replace: [], kept: [], remove: [], merge: [] };
  const was = installed?.files ?? {};
  // A shared file the vault has but the last install never wrote is the player's.
  const edited = (path) => path in current && (!(path in was) || current[path] !== was[path]);
  for (const path of Object.keys(release.files).sort()) {
    const { sha256, kind } = release.files[path];
    if (MERGED.includes(path)) (path in current ? plan.merge : plan.add).push(path);
    else if (!(path in current)) {
      if (kind === "managed" || !(path in was)) plan.add.push(path);
      else plan.kept.push(path); // a shared file the player deleted stays deleted
    } else if (current[path] === sha256) continue;
    else if (kind === "managed" || !edited(path)) plan.replace.push(path);
    else plan.kept.push(path);
  }
  for (const path of Object.keys(was).sort()) {
    if (path in release.files || !(path in current) || !categorize(path)) continue;
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

// A JSON value as text with every object's keys sorted and no whitespace, so formatting never changes its hash.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

// What a JSON settings file says about the keys the template ships (Obsidian adds its own defaults on load): `keys`
// null or the value not an object means the whole value.
function jsonView(text, keys) {
  const v = JSON.parse(text);
  if (!keys || !v || typeof v !== "object" || Array.isArray(v)) return canonical(v);
  return canonical(Object.fromEntries(keys.filter((k) => k in v).map((k) => [k, v[k]])));
}

// The bytes to write when replacing a shared JSON file: the template's keys over the player's file, keeping keys
// Obsidian or the player added.
function mergeJson(currentText, releaseText) {
  const mine = JSON.parse(currentText);
  const theirs = JSON.parse(releaseText);
  const merged = mine && typeof mine === "object" && !Array.isArray(mine) && theirs && typeof theirs === "object" && !Array.isArray(theirs)
    ? { ...mine, ...theirs } : theirs;
  return JSON.stringify(merged, null, 2) + "\n";
}

async function sha256Hex(text, subtle) {
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const rawUrl = (repo, tag, path) =>
  `https://raw.githubusercontent.com/${repo}/${tag}/${path.split("/").map(encodeURIComponent).join("/")}`;

module.exports = {
  MERGED, categorize, isSharedJson, planUpdate, mergeEnabledPlugins, mergeQuickAdd,
  canonical, jsonView, mergeJson, sha256Hex, rawUrl,
};
