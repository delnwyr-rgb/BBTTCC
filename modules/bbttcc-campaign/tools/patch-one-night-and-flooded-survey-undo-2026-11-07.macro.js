/*
 * patch-one-night-and-flooded-survey-undo-2026-11-07.macro.js — Dave 2026-11-07, Turn 2 aboard the Reliable:
 *   1. a2_that_one_night gets Dave's text.
 *   2. The Clowder's Act 2 outpost survey on Bedlam Barrens started the ACT 3 Flooded Towns (hexStory counted a later act's
 *      beats; fixed in module.js the same day). Undo it: the story store's survey start, the four Domain quest-log entries,
 *      the hex's quest link + hint, and the hex's survey "word sent" flag. The registry entry stays "active" (the normal
 *      state of an unstarted quest).
 *   3. "Clowder should get their resources back": the outpost cost 15 economy + 8 logistics and 1 economy came back for
 *      running it in person, so 14 economy + 8 logistics are credited (past the cap; the next Advance trims any overflow).
 * Ember Bad Eden. globalThis.__oneNightDry = false applies; anything else is a dry run. Idempotent (the refund is marked
 * on the Clowder: flags.bbttcc-campaign.refund_flooded_survey_2026_11_07).
 */
(async () => {
  const DRY_RUN = globalThis.__oneNightDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const QKEY = "flooded_towns", QID = "quest_dYfmXsGFyVseveWY";

  // 1. the One Night text
  const TEXT = [
    "One night, a turn after your arrival, plot happens.",
    "Everyone in the AOH (Avuncular Order Holdings) reports waking up in the middle of the night, feeling extremely uneasy. You report waking up in the middle of the night and feeling extremely uneasy.",
    "It was as if something incandescently angry had screamed at the object of its ire. Not you, but you adjacent. Something standing right next to you. You have an awful feeling of fear, and embarrassment, that is extremely disconcerting.",
    "People tried to brush it off.",
    "You tried to chalk it up as new sleeping quarters jitters. That everyone in the crew experienced. At the exact same time. In the exact same way.",
    "Then a week later, things start going wrong everywhere."
  ].join("\n\n");
  const beats = foundry.utils.deepClone(c.beats); const b = beats.find(x => x.id === "a2_that_one_night");
  if (!b) throw new Error("a2_that_one_night not found");
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("a2_that_one_night text"); if (!DRY_RUN) await C.saveCampaign(cid, { ...c, beats }); }

  // 2a. story store: the survey's start (only if it came from the survey — a real start stays)
  const all = foundry.utils.deepClone(game.settings.get("bbttcc-campaign", "storyState") || {});
  const st = all[cid];
  if (st?.started?.[QKEY]?.via === "survey") {
    report.changed.push("story store: flooded_towns survey start removed");
    if (!DRY_RUN) { delete st.started[QKEY]; await game.settings.set("bbttcc-campaign", "storyState", all); }
  }
  // 2b. the Domain quest logs
  for (const a of game.actors.filter(x => x.getFlag?.("bbttcc-factions", "quests")?.active?.[QID])) {
    report.changed.push(`${a.name}: quest log entry removed`);
    if (!DRY_RUN) { const q = foundry.utils.deepClone(a.getFlag("bbttcc-factions", "quests")); delete q.active[QID]; await a.unsetFlag("bbttcc-factions", "quests"); await a.setFlag("bbttcc-factions", "quests", q); }
  }
  // 2c. the hex: quest link + hint, and the survey flag
  const S = game.scenes.find(s => s.name.startsWith("Bad Eden — The Whole Map"));
  const hex = S?.drawings.contents.find(h => String(h.flags?.["bbttcc-territory"]?.name || "").replace(/[\s ]+/g, " ").trim() === "Bedlam Barrens");
  if (!hex) throw new Error("Bedlam Barrens not found");
  const tf = hex.flags["bbttcc-territory"];
  if (tf.quests?.[QID]) { report.changed.push("Bedlam Barrens: quest link removed"); if (!DRY_RUN) { const qs = foundry.utils.deepClone(tf.quests); delete qs[QID]; await hex.unsetFlag("bbttcc-territory", "quests"); if (Object.keys(qs).length) await hex.setFlag("bbttcc-territory", "quests", qs); } }
  if (tf.survey) { report.changed.push("Bedlam Barrens: survey flag cleared"); if (!DRY_RUN) await hex.unsetFlag("bbttcc-territory", "survey"); }

  // 3. the Clowder's refund
  const F = game.actors.getName("The Clowder");
  if (F && !F.getFlag("bbttcc-campaign", "refund_flooded_survey_2026_11_07")) {
    report.changed.push("The Clowder: +14 economy, +8 logistics");
    if (!DRY_RUN) {
      await game.bbttcc.api.op.commit(F.id, { economy: 14, logistics: 8 }, { source: "gm-refund", label: "Refund — Bedlam Barrens outpost (the survey fired an Act 3 story early)", allowOvercap: true });
      await F.setFlag("bbttcc-campaign", "refund_flooded_survey_2026_11_07", Date.now());
    }
  }
  if (!DRY_RUN && report.changed.length) { try { await C.story.project(cid); } catch (e) { console.warn("project failed", e); } }
  console.log("ONENIGHT " + JSON.stringify(report));
  return report;
})();
