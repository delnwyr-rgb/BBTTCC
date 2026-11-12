/*
 * patch-retire-old-mystery-bin-2026-11-12.macro.js — Dave (2026-11-12): "Retire the old one."
 * Two beats described the same barrel: the yard menu's "Browse the yard — the MYSTERY bin" (ans_fixit_town_walk_browse_the_yard,
 * stewardLoot, kept) and the older orphan fixit_mystery_bin (Reach in / Pat it / Ask, no choice routed to it — the director kept
 * offering it as "Next in the story"). The old one and its answer beats are retired the same way as the FFF Parley beats:
 * inject.requires gains { flag:"storyPhase", gte:99 }, so nothing offers or injects them. Kept (not deleted).
 * Ember Bad Eden. globalThis.__binDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__binDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const ids = beats.filter(b => b.id === "fixit_mystery_bin" || b.id.startsWith("ans_fixit_mystery_bin_")).map(b => b.id);
  if (!ids.includes("fixit_mystery_bin")) throw new Error("fixit_mystery_bin missing");
  for (const id of ids) {
    const b = beats.find(x => x.id === id);
    b.inject = b.inject || {};
    const req = Array.isArray(b.inject.requires) ? b.inject.requires : [];
    if (req.some(r => r?.flag === "storyPhase" && Number(r.gte) >= 99)) continue;
    b.inject.requires = [...req.filter(r => r?.flag !== "storyPhase"), { flag: "storyPhase", gte: 99 }];
    b.inject.retired = "2026-11-12 duplicate of Browse the yard (Dave)";
    report.changed.push(id);
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("OLDBIN " + JSON.stringify(report));
  return report;
})();
