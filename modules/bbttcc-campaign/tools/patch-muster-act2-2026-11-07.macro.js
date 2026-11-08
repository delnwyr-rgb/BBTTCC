/*
 * patch-muster-act2-2026-11-07.macro.js — Dave 2026-11-07 at Allesh-Gilliam: "we should not have opened up the Muster market
 * yet, and players will be gated from getting associations and crews until Act 2 — which is fine with me."
 *   • enc_bandit_ambush_win_free (freeing the first ambush's bandits) opened The Muster's market in Act 1 — its openMarket moves
 *     to allesh_gilliam_muster_intro (Act 2, a repeatable place), so the market opens when the party walks into the Muster.
 *   • The Town Militia's quest log says what Dave wrote, and no longer sends the party to a door that won't open.
 *   • The Muster vendor (the-muster) is switched off for players now; the Muster beat switches it back on.
 * Ember Bad Eden. globalThis.__musterAct2Dry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__musterAct2Dry !== false, report = { DRY_RUN, changed: [] };
  const WIN = "enc_bandit_ambush_win_free", MUSTER = "allesh_gilliam_muster_intro", QID = "quest_ag_town_militia";
  const DESC = "You've founded a town militia, apparently. With freed Road Bandits.\n\nThat's really doing it the hard way.\n\nIt's still in its infancy, and not yet ready for prime-time.\n\nBut as a leader, you feel good about delegating.";
  const NEXT = "Brakk has it in hand. Check back when the militia is ready for prime-time.";
  const OPEN = { vendorName: "The Muster", note: "🪖 The Muster has a banner up — crews and associations for hire, by the turn.", activate: true };

  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats), story = foundry.utils.deepClone(c.story || {});
  const win = beats.find(b => b.id === WIN), mus = beats.find(b => b.id === MUSTER);
  if (!win || !mus) throw new Error("beat not found");
  if (win.worldEffects?.openMarket) { delete win.worldEffects.openMarket; report.changed.push(`${WIN}: openMarket removed`); }
  mus.worldEffects = mus.worldEffects || {};
  if (!mus.worldEffects.openMarket) { mus.worldEffects.openMarket = OPEN; report.changed.push(`${MUSTER}: opens the Muster market`); }
  const mil = story?.scripts?.allesh_gilliam?.chapters?.the_town_militia;
  if (mil && mil.line !== NEXT) { mil.line = NEXT; report.changed.push("militia chapter Next line"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats, story });

  // raw write: quests.saveQuest normalises the record and drops `giver` / `nextLine` (the log's From: and Next lines)
  const raw = foundry.utils.deepClone(game.settings.get("bbttcc-campaign", "quests") || {}), q = raw[QID];
  if (q && (q.description !== DESC || q.nextLine !== NEXT || q.giver !== "the bandits you let walk")) {
    report.changed.push("quest registry text");
    if (!DRY_RUN) { raw[QID] = { ...q, description: DESC, nextLine: NEXT, giver: "the bandits you let walk", updatedTs: Date.now() }; await game.settings.set("bbttcc-campaign", "quests", raw); }
  }

  const v = (await game.bbttcc.api.market.listVendors()).find(x => x?.id === "the-muster");
  if (v?.active) {
    report.changed.push("the-muster vendor closed");
    if (!DRY_RUN) await game.bbttcc.api.worldMutation.applyWorldEffects({ id: "patch-muster-act2", worldEffects: { closeMarket: { vendorId: "the-muster" } } }, { source: "bbttcc-campaign", campaignId: id, beatId: "patch-muster-act2" });
  }
  console.log("MUSTERACT2 " + JSON.stringify(report));
  return report;
})();
