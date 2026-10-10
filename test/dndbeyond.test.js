const { test } = require("node:test");
const assert = require("node:assert/strict");
const d = require("../_lorekeeper/lib/dndbeyond.js");

test("parseLink accepts character links, campaign links and bare ids, strictly", () => {
  assert.deepEqual(d.parseLink("137202151"), { character: 137202151 });
  assert.deepEqual(d.parseLink("https://www.dndbeyond.com/characters/137202151/GpDg8C"), { character: 137202151 });
  assert.deepEqual(d.parseLink("dndbeyond.com/characters/5"), { character: 5 });
  assert.deepEqual(d.parseLink("https://www.dndbeyond.com/profile/vexer/characters/6"), { character: 6 });
  assert.throws(() => d.parseLink("https://www.dndbeyond.com/campaigns/42"), { message: d.MESSAGES.campaign });
  assert.throws(() => d.parseLink("https://www.dndbeyond.com/campaigns/join/abc"), { message: "That's a campaign invite. Paste a link to a character in the campaign instead: its party comes along." });
  for (const bad of ["https://evil.com/characters/5", "https://dndbeyond.com.evil.net/characters/5", "ftp://www.dndbeyond.com/characters/5",
    "https://www.dndbeyond.com/monsters/5", "", "1234567890123456"])
    assert.throws(() => d.parseLink(bad), { message: "That isn't a link to a D&D Beyond character." }, bad);
});

test("sheetId and sheetUrl", () => {
  assert.equal(d.sheetUrl(5), "https://www.dndbeyond.com/characters/5");
  assert.equal(d.sheetId("https://www.dndbeyond.com/characters/5"), "5");
  assert.equal(d.sheetId("https://dndbeyond.com/profile/x/characters/7/abc"), "7");
  assert.equal(d.sheetId("https://evil.com/characters/5"), "");
});

const DEMUS = { data: {
  name: " Demus ", race: { fullName: "Hill Dwarf", baseName: "Dwarf" },
  classes: [
    { level: 3, definition: { name: "Fighter" }, subclassDefinition: { name: "Champion" } },
    { level: 1, definition: { name: "Rogue" } },
  ],
  background: { definition: { name: "Folk Hero" } }, alignmentId: 3,
  age: 52, eyes: "Grey", hair: "", traits: { appearance: "A braided beard.", ideals: "Family.\nAlways.", flaws: " " },
  decorations: { avatarUrl: "https://www.dndbeyond.com/avatars/1/2/demus.jpeg" },
  campaign: { characters: [
    { characterId: 5, characterName: "Demus", username: "demus_player" },
    { characterId: 6, characterName: "Vex", username: "vexer" },
    { characterName: "No id" },
  ] },
} };

test("reads a reply defensively", () => {
  assert.deepEqual(d.parseCharacter(5, DEMUS), {
    id: 5, name: "Demus", race: "Hill Dwarf", classes: "Fighter 3 (Champion) / Rogue 1", level: 4, player: "demus_player",
    url: "https://www.dndbeyond.com/characters/5", background: "Folk Hero", alignment: "Chaotic Good",
    appearance: "Age 52 · Eyes Grey\n\nA braided beard.", personality: "**Ideals:**\n- Family.\n- Always.",
    portrait: "https://www.dndbeyond.com/avatars/1/2/demus.jpeg", error: "",
  });
  assert.deepEqual(d.party(DEMUS), [[5, "Demus", "demus_player"], [6, "Vex", "vexer"]]);
  const one = d.parseCharacter(6, { data: { name: "Vex", username: "vexer2", race: { baseName: "Elf" }, classes: [{ level: 2, definition: { name: "Wizard" } }] } });
  assert.deepEqual([one.race, one.classes, one.level, one.player], ["Elf", "Wizard", 2, "vexer2"]);
  const empty = d.parseCharacter(9, { data: { classes: "oops", race: null } });
  assert.deepEqual([empty.name, empty.classes, empty.level, empty.alignment, empty.portrait], ["", "", 0, "", ""]);
  assert.deepEqual(d.party(null), []);
  const custom = d.parseCharacter(9, { data: { background: { customBackground: { name: "Exile" } }, alignmentId: 10, decorations: { avatarUrl: "http://evil.example/x.jpg" } } });
  assert.deepEqual([custom.background, custom.alignment, custom.portrait], ["Exile", "", ""]);
});

test("portraits only from dndbeyond and only pictures", () => {
  assert.equal(d.portraitUrl("https://www.dndbeyond.com/avatars/1.jpeg"), true);
  for (const bad of ["http://www.dndbeyond.com/a.jpg", "https://dndbeyond.com.evil.net/a.jpg", "https://evil.net/a.jpg", "nope"])
    assert.equal(d.portraitUrl(bad), false, bad);
  assert.equal(d.imageExt(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(d.imageExt(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), "png");
  assert.equal(d.imageExt(new TextEncoder().encode("GIF89a")), "gif");
  assert.equal(d.imageExt(new TextEncoder().encode("RIFF1234WEBPVP8")), "webp");
  assert.equal(d.imageExt(new TextEncoder().encode("<html>")), null);
});

test("tokenFrom and characterError", () => {
  assert.equal(d.tokenFrom(200, { token: "t" }), "t");
  assert.throws(() => d.tokenFrom(401, {}), { message: d.MESSAGES.expired });
  assert.throws(() => d.tokenFrom(200, {}), { message: d.MESSAGES.expired });
  assert.throws(() => d.tokenFrom(500, {}), /sign-in service said: 500/);
  assert.equal(d.characterError(403, null, 5), d.MESSAGES.notShared);
  assert.equal(d.characterError(404, null, 5), "D&D Beyond has no character 5.");
  assert.equal(d.characterError(500, { message: "Boom" }, 5), "D&D Beyond said: Boom (500)");
});

test("lookup follows the party, once each, and reports unreadable characters", async () => {
  const replies = { 5: { status: 200, json: DEMUS }, 6: { status: 403, json: null } };
  const getJson = async (url) => replies[url.split("/").pop()];
  const found = await d.lookup("https://www.dndbeyond.com/characters/5", { getJson, token: "" });
  assert.deepEqual(found.map((c) => [c.id, c.name, c.player, c.error]), [
    [5, "Demus", "demus_player", ""],
    [6, "Vex", "vexer", d.MESSAGES.notShared],
  ]);
});

test("lookup sends the token as a bearer header", async () => {
  let seen;
  await d.lookup("5", { getJson: async (url, headers) => { seen = headers; return { status: 200, json: { data: { name: "A" } } }; }, token: "tok" });
  assert.deepEqual(seen, { Authorization: "Bearer tok" });
});

test("odd numbers in a reply are ignored, not read", () => {
  const odd = { data: {
    name: "Odd", age: -3, height: 1.5, eyes: "Grey",
    classes: [{ level: -1, definition: { name: "Bard" } }, { level: 1.5, definition: { name: "Druid" } }],
    campaign: { characters: [{ characterId: -1, characterName: "Neg" }, { characterId: 1.5, characterName: "Frac" }, { characterId: 7, characterName: "Ok" }] },
  } };
  const c = d.parseCharacter(9, odd);
  assert.deepEqual([c.appearance, c.classes, c.level], ["Eyes Grey", "Bard 0 / Druid 0", 0]);
  assert.deepEqual(d.party(odd), [[7, "Ok", ""]]);
});

test("a reply whose data is a list is a bad reply", async () => {
  const getJson = async () => ({ status: 200, json: { data: [] } });
  const [c] = await d.lookup("5", { getJson, token: "" });
  assert.deepEqual([c.name, c.error], ["Character 5", "D&D Beyond said: unexpected reply (200)"]);
});

test("a message that is not text is not shown", () => {
  assert.equal(d.characterError(500, { message: { text: "Boom" } }, 5), "D&D Beyond said: unexpected reply (500)");
});

test("a character that can't be reached is its own error row, and the lookup goes on", async () => {
  const getJson = async (url) => {
    if (url.endsWith("/6")) throw new Error("offline");
    return { status: 200, json: DEMUS };
  };
  const found = await d.lookup("5", { getJson, token: "" });
  assert.deepEqual(found.map((c) => [c.id, c.name, c.error]), [
    [5, "Demus", ""],
    [6, "Vex", d.MESSAGES.unreachable],
  ]);
});
