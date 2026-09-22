// seed-story-data-from-code.macro.js — RUN IN-WORLD (GM). Layer 2 of GM authoring parity (2026-09-21).
// Copies the SHIPPED story tables (story-scripts.js scripts + story-model.js QUEST_MAP quests) into the
// ACTIVE campaign's `campaign.story` so every Bad Eden quest script can be edited on the Campaign
// Builder's Quests tab (✦ Script). Keys already authored in the campaign are KEPT (set OVERWRITE=true to
// replace them). The code tables stay as the fallback for anything not in data.
// Same thing as the Quests-tab "⤓ Seed shipped scripts" button, for the macro bar. DRY_RUN=true reports only.
(async () => {
  const DRY_RUN = true;        // <-- set false to apply
  const OVERWRITE = false;
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const api = game.bbttcc?.api?.campaign; if (!api?.story?.data?.seedFromCode) return ui.notifications.error("bbttcc-campaign story data API not loaded.");
  const cid = api.getActiveCampaignId?.(); if (!cid) return ui.notifications.warn("No active campaign.");
  const r = await api.story.data.seedFromCode(cid, { dryRun: DRY_RUN, overwrite: OVERWRITE });
  const line = `seed-story-data ${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} — campaign ${cid}: +${r.added.quests.length} quest(s), +${r.added.scripts.length} script(s) → totals ${r.totals.quests} quests / ${r.totals.scripts} scripts`;
  console.log(line, r.added);
  ui.notifications.info(line + (DRY_RUN ? " — set DRY_RUN=false to apply." : ""));
})();
