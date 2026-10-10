// D&D Beyond: links, character-service replies and portraits, ported from Lorekeeper's src-tauri/src/dndbeyond.rs
// (32a07f6). The network call is passed in (getJson) so lookup() is testable.

const SITE = "https://www.dndbeyond.com";
const MAX_CHARACTERS = 30;
const MESSAGES = {
  expired: "Your D&D Beyond sign-in expired. Run Sign in to D&D Beyond again.",
  notShared: "D&D Beyond won't share this character. Run Sign in to D&D Beyond, or set the character to Public.",
  unreachable: "Couldn't reach D&D Beyond. Check your internet connection.",
  badLink: "That isn't a link to a D&D Beyond character.",
  campaign: "Paste a link to a character in the campaign instead: its party comes along.",
  invite: "That's a campaign invite. Paste a link to a character in the campaign instead: its party comes along.",
};
const ALIGNMENTS = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"];

const sheetUrl = (id) => `${SITE}/characters/${id}`;
const sheetId = (url) => String(url ?? "").match(/^https:\/\/(?:www\.)?dndbeyond\.com\/(?:[^?#]*\/)?characters\/(\d+)/)?.[1] ?? "";
const number = (s) => (/^\d{1,15}$/.test(s) ? Number(s) : null);
const text = (v) => (typeof v === "string" ? v.trim() : "");
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function parseLink(link) {
  const trimmed = String(link).trim();
  const bare = number(trimmed);
  if (bare !== null) return { character: bare };
  let url;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error(MESSAGES.badLink);
  }
  if (!["https:", "http:"].includes(url.protocol) || !["www.dndbeyond.com", "dndbeyond.com"].includes(url.hostname)) throw new Error(MESSAGES.badLink);
  const parts = url.pathname.split("/").filter(Boolean);
  let found = null;
  if (parts[0] === "characters") found = number(parts[1] ?? "") !== null && { character: number(parts[1]) };
  else if (parts[0] === "profile" && parts[2] === "characters") found = number(parts[3] ?? "") !== null && { character: number(parts[3]) };
  else if (parts[0] === "campaigns" && parts[1] === "join") throw new Error(MESSAGES.invite);
  else if (parts[0] === "campaigns") throw new Error(MESSAGES.campaign);
  if (!found) throw new Error(MESSAGES.badLink);
  return found;
}

function party(v) {
  const members = v?.data?.campaign?.characters;
  return Array.isArray(members)
    ? members.filter((m) => count(m?.characterId)).map((m) => [m.characterId, text(m.characterName), text(m.username)])
    : [];
}

function appearance(d) {
  const looks = [["Gender", "gender"], ["Age", "age"], ["Height", "height"], ["Weight", "weight"], ["Eyes", "eyes"], ["Hair", "hair"], ["Skin", "skin"]]
    .map(([label, key]) => {
      const v = typeof d[key] === "number" ? (count(d[key]) ? String(d[key]) : "") : text(d[key]);
      return v ? `${label} ${v}` : "";
    })
    .filter(Boolean);
  return [looks.join(" · "), text(d.traits?.appearance)].filter(Boolean).join("\n\n");
}

function personality(traits) {
  return [["Traits", "personalityTraits"], ["Ideals", "ideals"], ["Bonds", "bonds"], ["Flaws", "flaws"]]
    .map(([label, key]) => {
      const lines = text(traits?.[key]).split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return "";
      return lines.length === 1 ? `**${label}:** ${lines[0]}` : `**${label}:**\n${lines.map((l) => `- ${l}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function portraitUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "dndbeyond.com" || u.hostname.endsWith(".dndbeyond.com"));
  } catch {
    return false;
  }
}

function imageExt(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

function parseCharacter(id, v) {
  const d = isObject(v?.data) ? v.data : {};
  const race = text(d.race?.fullName) || text(d.race?.baseName);
  const classes = (Array.isArray(d.classes) ? d.classes : [])
    .map((c) => [text(c?.definition?.name), count(c?.level) ? c.level : 0, text(c?.subclassDefinition?.name)])
    .filter(([name]) => name);
  const sub = (s) => (s ? ` (${s})` : "");
  const names = classes.length === 1 ? `${classes[0][0]}${sub(classes[0][2])}` : classes.map(([n, l, s]) => `${n} ${l}${sub(s)}`).join(" / ");
  const own = party(v).find((m) => m[0] === id)?.[2] ?? "";
  const avatar = text(d.decorations?.avatarUrl);
  return {
    id, name: text(d.name), race, classes: names, level: classes.reduce((sum, c) => sum + c[1], 0),
    player: text(d.username) || own, url: sheetUrl(id),
    background: text(d.background?.definition?.name) || text(d.background?.customBackground?.name),
    alignment: Number.isInteger(d.alignmentId) ? ALIGNMENTS[d.alignmentId - 1] ?? "" : "",
    appearance: appearance(d), personality: personality(d.traits), portrait: portraitUrl(avatar) ? avatar : "", error: "",
  };
}

function tokenFrom(status, json) {
  const token = json?.token;
  if (status >= 200 && status < 300 && typeof token === "string" && token) return token;
  if (status === 401 || status === 403 || (status >= 200 && status < 300)) throw new Error(MESSAGES.expired);
  throw new Error(`D&D Beyond's sign-in service said: ${status}`);
}

function characterError(status, json, id) {
  if (status === 401 || status === 403) return MESSAGES.notShared;
  if (status === 404) return `D&D Beyond has no character ${id}.`;
  return `D&D Beyond said: ${typeof json?.message === "string" ? json.message : "unexpected reply"} (${status})`;
}

// A character that couldn't be read: its row says why, and the lookup goes on.
const failed = (id, name, user, error) => ({
  id, name: name || `Character ${id}`, race: "", classes: "", level: 0, player: user, url: sheetUrl(id),
  background: "", alignment: "", appearance: "", personality: "", portrait: "", error,
});

async function lookup(link, { getJson, token }) {
  const queue = [[parseLink(link).character, "", ""]];
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const found = [];
  for (let next = 0; next < queue.length && found.length < MAX_CHARACTERS; next++) {
    const [id, name, user] = queue[next];
    let res;
    try {
      res = await getJson(`https://character-service.dndbeyond.com/character/v5/character/${id}`, headers);
    } catch {
      found.push(failed(id, name, user, MESSAGES.unreachable));
      continue;
    }
    if (res.status >= 200 && res.status < 300 && isObject(res.json?.data)) {
      for (const member of party(res.json)) if (!queue.some((q) => q[0] === member[0])) queue.push(member);
      const c = parseCharacter(id, res.json);
      found.push({ ...c, player: c.player || user });
    } else {
      found.push(failed(id, name, user, characterError(res.status, res.json, id)));
    }
  }
  return found;
}

module.exports = { MESSAGES, MAX_CHARACTERS, ALIGNMENTS, sheetUrl, sheetId, parseLink, party, parseCharacter, portraitUrl, imageExt, tokenFrom, characterError, lookup };
