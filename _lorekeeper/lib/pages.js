// Page kinds: one per file in Templates/, each with its folder (Lorekeeper's New page).

const KIND_FOLDERS = { PC: "PCs", NPC: "NPCs", Location: "Locations", Item: "Items", Faction: "Factions", Quest: "Quests", Lore: "Lore" };
const BUILT_IN = Object.keys(KIND_FOLDERS);

function kinds(templateNames) {
  const names = templateNames.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
  const custom = names.filter((n) => !BUILT_IN.includes(n)).sort((a, b) => a.localeCompare(b));
  return [...BUILT_IN.filter((k) => names.includes(k)), ...custom];
}

function folderFor(kind, folders) {
  if (KIND_FOLDERS[kind]) return KIND_FOLDERS[kind];
  if (folders.includes(`${kind}s`)) return `${kind}s`;
  return folders.includes(kind) ? kind : "";
}

function nameProblem(name, existing) {
  const n = name.trim();
  if (!n) return "Type a name.";
  if (/[/\\:*?"<>|#^[\]]/.test(n)) return 'A name can\'t use / \\ : * ? " < > | # ^ [ ]';
  if (n.startsWith(".") || n.endsWith(".")) return "A name can't start or end with a dot.";
  const taken = existing.find((e) => e.toLowerCase() === n.toLowerCase());
  return taken ? `There's already a page called ${taken}.` : null;
}

module.exports = { KIND_FOLDERS, kinds, folderFor, nameProblem };
