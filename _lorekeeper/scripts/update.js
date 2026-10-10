// QuickAdd: Update Lorekeeper. Shows what the latest release would change, asks, then updates (lib/updater.js).
module.exports = async ({ app, quickAddApi, obsidian }) => {
  const m = { exports: {} };
  new Function("module", await app.vault.adapter.read("_lorekeeper/lib/load.js"))(m);
  const lk = await m.exports(app);
  const ctx = { adapter: app.vault.adapter, request: obsidian.requestUrl, subtle: crypto.subtle, update: lk.update };
  let prepared;
  try {
    prepared = await lk.updater.prepare(ctx);
  } catch (e) {
    return new obsidian.Notice(`Couldn't check for updates: ${e.message}`);
  }
  if (prepared.latest) return new obsidian.Notice(`Lorekeeper is up to date (v${prepared.version}).`);
  const { plan, release } = prepared;
  const lines = [
    `${plan.add.length} new, ${plan.replace.length} updated, ${plan.remove.length} removed, ${plan.merge.length} merged.`,
    plan.kept.length ? `Kept because you edited them: ${plan.kept.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
  const go = await quickAddApi.yesNoPrompt(`Update to v${release.version}?`, lines).catch(() => false);
  if (!go) return;
  const out = await lk.updater.apply({ ...ctx, ...prepared });
  if (out.failed.length) return new obsidian.Notice(`Some files didn't update: ${out.failed.join(", ")}. Run Update Lorekeeper again.`, 0);
  new obsidian.Notice(`Updated to v${release.version}.`);
  if (out.reload && (await quickAddApi.yesNoPrompt("Reload Obsidian?", "Plugins or the theme changed. Reload to use them.").catch(() => false)))
    app.commands.executeCommandById("app:reload");
};
