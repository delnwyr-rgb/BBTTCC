/*
 * patch-arc-bay-coffee-cafe-meal-2026-11-10.macro.js — Dave at Arc Bay (2026-11-10): "The Coffee … in this scene is part of the
 * Well Fed / Recalcitrant Cafe beat, and is one of the things that is supposed to give us a buff, and gates finding YG's coffee
 * on the Absolutely Reliable." The answer (ans_fixit_arc_bay_drink_the_coffee) granted nothing and the Reliable's "Brew Young
 * Gearbox's forgotten coffee" gate (reliable_the_lease → rc_gearbox_coffee) never looked at it.
 *   • ans_fixit_arc_bay_drink_the_coffee becomes a café meal like rc_pike_coffee: worldEffects.partyEffects "Gearbox's Coffee"
 *     (+1 Violence checks, one turn — Violence is the faculty no other café meal covers), once only (inject.repeatable false,
 *     evergreen off) so the menu choice locks with ✓ after the cup.
 *   • Every choice into rc_gearbox_coffee (reliable_the_lease, reliable_galley, ag_days_end, days_end_thatwards) that requires
 *     the café marks also requires beatMark ans_fixit_arc_bay_drink_the_coffee.
 *   • THIS playthrough: if the coffee has been drunk already (played) and no Steward holds the buff, it is granted now through
 *     the world-mutation engine (report.granted) — once.
 * Ember Bad Eden. globalThis.__arcCoffeeDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__arcCoffeeDry !== false;
  const ID = "ans_fixit_arc_bay_drink_the_coffee";
  const report = { DRY_RUN, changed: [], granted: null };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const cup = beats.find(b => b.id === ID); if (!cup) throw new Error(`${ID} not found`);
  const PE = [{ name: "Gearbox's Coffee", note: "Terrible. The best you've had since you got here. Your hands know what to do with a wrench now.",
    duration: "turn", turns: 1, img: "icons/consumables/drinks/coffee.webp",
    checkBonus: [{ context: "check", attribute: "violence", bonus: 1, note: "Gearbox's Coffee" }] }];
  cup.worldEffects = cup.worldEffects || {};
  if (JSON.stringify(cup.worldEffects.partyEffects) !== JSON.stringify(PE)) { cup.worldEffects.partyEffects = PE; report.changed.push("coffee: partyEffects Gearbox's Coffee (+1 Violence checks, 1 turn)"); }
  if (cup.inject?.repeatable !== false || cup.inject?.evergreen) { cup.inject = { ...(cup.inject || {}), repeatable: false, evergreen: false }; report.changed.push("coffee: once only"); }

  for (const b of beats) for (const ch of b.choices || []) {
    if (ch.next !== "rc_gearbox_coffee" || !Array.isArray(ch.requires)) continue;
    if (!ch.requires.some(r => r?.beatMark === "rc_pike_coffee")) continue;   // only the café-gated doors
    if (ch.requires.some(r => r?.beatMark === ID)) continue;
    ch.requires.push({ beatMark: ID });
    report.changed.push(`gate: ${b.id} → rc_gearbox_coffee now needs the Arc Bay coffee`);
  }

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });

  const played = !!game.settings.get("bbttcc-campaign", "storyState")?.[cid]?.played?.[ID];
  const holds = game.actors.contents.some(a => a.items.some(i => i.flags?.["bbttcc-campaign"]?.partyEffect?.name === "Gearbox's Coffee"));
  if (played && !holds) {
    report.granted = "pending: coffee already drunk, buff missing";
    if (!DRY_RUN) {
      await game.bbttcc.api.worldMutation.applyWorldEffects({ id: ID, label: cup.label, worldEffects: { partyEffects: PE } },
        { source: "bbttcc-campaign", campaignId: cid, beatId: ID });
      report.granted = "granted now";
    }
  }
  console.log("ARCCOFFEE " + JSON.stringify(report));
  return report;
})();
