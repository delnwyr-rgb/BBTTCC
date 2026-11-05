/**
 * patch-remove-offices-beats-2026-11-05.macro.js — Dave 2026-11-05: the opening titles (As Above, So Below … Guess What) and the
 * Teaching Slides are no longer part of the story; players see them before the game starts (landing page mp4s).
 * Removes every fates_and_destinies_* beat, opens the campaign on Thatwards Ho!, blanks the two onboarding hand-offs and strikes
 * any played marks. Scenes and media are left alone. Removed beats are written to bbttcc-exports first.
 * Idempotent. DRY_RUN first (globalThis.__offDry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__offDry !== false;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const NEW_OPENING = "thatwards_ho_opening_scene";
  const isGone = (x) => /^fates_and_destinies/.test(String(x || ""));
  if (!c.beats.some(b => b.id === NEW_OPENING)) throw new Error("no Thatwards Ho beat");
  const gone = c.beats.filter(b => isGone(b.id)), ids = gone.map(b => b.id);
  const keep = c.beats.filter(b => !isGone(b.id));
  // anything left that still names a removed beat (the opening pointer is rewritten below)
  const dangling = [];
  const walk = (o, p) => {
    if (typeof o === "string") { if (/fates_and_destinies/.test(o)) dangling.push(`${p}: ${o.slice(0, 80)}`); }
    else if (o && typeof o === "object") for (const k in o) walk(o[k], `${p}.${k}`);
  };
  for (const b of keep) walk(b, `beat:${b.id}`);
  const { beats: _b, openingBeatId: _o, ...rest } = c; walk(rest, "campaign");
  try { walk(C.quests.getAllQuests(), "quests"); walk(game.settings.get("bbttcc-campaign", "encounterTables"), "tables"); } catch (e) { dangling.push(`scan: ${e.message}`); }
  const played = Object.keys(C.story.state(id)?.played || {}).filter(isGone);
  const SET = ["campaignWakeBeatId", "campaignResumeBeatId"].filter(k => isGone(game.settings.get("bbttcc-onboarding", k)));
  const report = { DRY_RUN, remove: ids.length, opening: `${c.openingBeatId} -> ${NEW_OPENING}`, settings: SET, played, dangling };
  if (dangling.length) { console.log("OFFICES", JSON.stringify(report)); return ui.notifications.error("Removed beats are still referenced; nothing changed."); }
  if (!DRY_RUN) {
    if (gone.length) {
      const file = new File([JSON.stringify({ campaignId: id, openingBeatId: c.openingBeatId, beats: gone }, null, 1)], "removed-offices-beats-2026-11-05.json", { type: "application/json" });
      const up = await foundry.applications.apps.FilePicker.implementation.upload("data", "bbttcc-exports", file, {}, { notify: false });
      if (!up?.path) throw new Error("backup upload failed; nothing removed");
      report.backup = up.path;
    }
    await C.saveCampaign(id, { ...c, beats: keep, openingBeatId: NEW_OPENING });
    for (const k of SET) await game.settings.set("bbttcc-onboarding", k, "");
    if (played.length) await C.story.forget(played, id);
  }
  console.log("OFFICES", JSON.stringify(report));
  ui.notifications.info(`Offices beats: ${DRY_RUN ? "dry run" : "applied"}, ${ids.length} to remove.`);
})();
