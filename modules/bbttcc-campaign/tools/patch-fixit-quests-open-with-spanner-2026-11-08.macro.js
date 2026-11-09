/*
 * patch-fixit-quests-open-with-spanner-2026-11-08.macro.js — Dave (2026-11-08, after the East Wall): the Quest Log showed
 * "Furrier's Fixit Farm — You carry the Leygate engineer's spanner" while Allesh-Gilliam still said "Visit the Leygate and talk
 * to Garren" — nobody held the Tetrarch Spanner. Pike's HQ intro (allesh_gilliam_introduction_to_hq) started BOTH Fixit quests
 * (story.alsoStarts fixit_farm + chapter the_leyline_stabilizer, plus the matching questEffects accept rows) before Garren
 * hands over the spanner. Dave: "I like the tidier option" → the starts move to Garren's beat.
 *   1. Campaign: allesh_gilliam_introduction_to_hq loses the two alsoStarts + the two accept rows; ag_leygate_visit gains them
 *      (both of its choices grant tetrarch_spanner, so the quests open the moment Garren gives it).
 *   2. This playthrough (only when the spanner is NOT held and ag_leygate_visit has NOT played): storyState forgets the
 *      started records that came "via also:allesh_gilliam_introduction_to_hq", and the coalition ledgers drop the two quests
 *      from `active` (the projection never un-starts a quest, so this is the cleanup step).
 * Reports every beat that gates on the two quests (report.gates) so nothing goes dark unseen.
 * Ember Bad Eden. globalThis.__fixitSpannerDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__fixitSpannerDry !== false;
  const HQ = "allesh_gilliam_introduction_to_hq", LV = "ag_leygate_visit";
  const QFARM = "quest_nrkJabUwZOLAJFYn", QSTAB = "quest_bSwOIWzxqNBwJ5NM";
  const report = { DRY_RUN, campaign: [], playthrough: [], gates: [], skipped: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const hq = beats.find(b => b.id === HQ), lv = beats.find(b => b.id === LV);
  if (!hq || !lv) throw new Error("HQ intro or Leygate visit beat not found");

  // 1 — campaign data
  const isFixitStart = (a) => a?.quest === "fixit_farm";
  const moved = (hq.story?.alsoStarts || []).filter(isFixitStart);
  if (moved.length) {
    hq.story.alsoStarts = hq.story.alsoStarts.filter(a => !isFixitStart(a));
    if (!hq.story.alsoStarts.length) delete hq.story.alsoStarts;
    lv.story = lv.story || { quest: "allesh_gilliam" };
    lv.story.alsoStarts = lv.story.alsoStarts || [];
    for (const a of moved) if (!lv.story.alsoStarts.some(x => x.quest === a.quest && (x.chapter || "") === (a.chapter || ""))) lv.story.alsoStarts.push(a);
    report.campaign.push(`story.alsoStarts ×${moved.length}: ${HQ} → ${LV}`);
  }
  const isFixitRow = (r) => r?.action === "accept" && (r.questId === QFARM || r.questId === QSTAB);
  const hqRows = hq.worldEffects?.questEffects || [];
  const rows = hqRows.filter(isFixitRow);
  if (rows.length) {
    hq.worldEffects.questEffects = hqRows.filter(r => !isFixitRow(r));
    lv.worldEffects = lv.worldEffects || {};
    lv.worldEffects.questEffects = lv.worldEffects.questEffects || [];
    for (const r of rows) if (!lv.worldEffects.questEffects.some(x => x.action === "accept" && x.questId === r.questId)) lv.worldEffects.questEffects.push(r);
    report.campaign.push(`questEffects accept ×${rows.length}: ${HQ} → ${LV}`);
  }

  for (const b of beats) {
    const s = JSON.stringify({ r: b.requires, i: b.inject?.requires, ch: (b.choices || []).map(x => x.requires) });
    if (s.includes(QFARM) || s.includes(QSTAB) || /"quest":"fixit_farm"/.test(s)) report.gates.push(b.id);
  }

  // 2 — this playthrough
  const held = (game.actors?.contents || []).some(a => a.items.some(i => i.flags?.["bbttcc-campaign"]?.questItem?.key === "tetrarch_spanner"));
  const lvPlayed = !!(game.settings.get("bbttcc-campaign", "storyState")?.[cid]?.played?.[LV]);
  if (held || lvPlayed) report.skipped.push(`playthrough left alone (spanner held: ${held}, ${LV} played: ${lvPlayed})`);
  else {
    const all = foundry.utils.deepClone(game.settings.get("bbttcc-campaign", "storyState") || {});
    const st = all[cid];
    const via = "also:" + HQ;
    if (st?.started?.fixit_farm?.via === via) { delete st.started.fixit_farm; report.playthrough.push("storyState: fixit_farm un-started"); }
    const ch = st?.chapters?.fixit_farm?.the_leyline_stabilizer;
    if (ch?.started?.via === via) { delete ch.started; report.playthrough.push("storyState: the_leyline_stabilizer un-started"); }
    if (!DRY_RUN && report.playthrough.length) await game.settings.set("bbttcc-campaign", "storyState", all);
    const FD = foundry.data.operators.ForcedDeletion;
    const factionIds = (c.factionIds || []).length ? c.factionIds
      : game.actors.contents.filter(a => { const q = a.getFlag?.("bbttcc-factions", "quests"); return q?.active?.[QFARM] || q?.active?.[QSTAB]; }).map(a => a.id);
    if (!factionIds.length) report.skipped.push("no coalition factions found");
    for (const id of factionIds) {
      const f = game.actors.get(String(id).replace(/^Actor\./, "")); if (!f) { report.skipped.push(`faction ${id} not found`); continue; }
      const q = f.getFlag("bbttcc-factions", "quests") || {};
      const del = {};
      for (const qid of [QFARM, QSTAB]) if (q.active?.[qid]) del[`flags.bbttcc-factions.quests.active.${qid}`] = new FD();
      if (Object.keys(del).length) { report.playthrough.push(`${f.name}: ${Object.keys(del).length} quest(s) back off the log`); if (!DRY_RUN) await f.update(del); }
    }
  }

  if (!DRY_RUN && report.campaign.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("FIXITSPANNER " + JSON.stringify(report));
  return report;
})();
