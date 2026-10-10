// QuickAdd: Pick your character. Who you play on this device in a shared campaign (or the DM, or nobody for solo).
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  const DM = "I'm the DM (no character)";
  const SOLO = "Play solo";
  const names = (await lk.io.list("PCs")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
  const choice = await quickAddApi.suggester([...names, DM, SOLO], [...names, DM, SOLO]).catch(() => null); // Esc
  if (!choice) return;
  const name = choice === DM ? lk.party.DM : choice === SOLO ? "" : choice;
  if (choice !== DM && choice !== SOLO && !lk.party.canPick(choice)) return new obsidian.Notice("A PC page named DM can't be the character you play.");
  const node = obsidian.Platform?.isDesktopApp ? { fs: window.require("fs"), os: window.require("os"), path: window.require("path") } : {};
  const warning = await lk.identity.setMe(app, name, { ...node, desktop: !!obsidian.Platform?.isDesktopApp, party: lk.party });
  new obsidian.Notice(name === lk.party.DM ? "You're the DM." : name ? `You play ${name}.` : "Playing solo.");
  if (warning) new obsidian.Notice(`Couldn't tell the note box outside Obsidian: ${warning}`, 8000);
};
