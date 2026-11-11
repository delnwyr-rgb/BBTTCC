/*
 * patch-arc-bay-stabilizer-line-and-market-2026-11-10.macro.js — Dave at Arc Bay (2026-11-10): "it is odd that there isn't a choice
 * off the bat asking about a stabilizer … there should be a line asking about the stabilizer that leads to this updated beat … and
 * the Anything for Sale? question should open up the Arc Bay Market."
 *   fixit_arc_bay_conversation:
 *     • NEW first line "We're here about the Leyline Stabilizer." → fixit_arc_bay_conversation_2 (while the stabilizer quest is
 *       not completed: questBucket quest_bSwOIWzxqNBwJ5NM isNot completed).
 *     • "Anything for sale?" → NEW ans_fixit_arc_bay_anything_for_sale (repeatable): worldEffects.openMarket on the Arc Bay
 *       vendor (resolved by name "The Arc Bay"); exits Back to the bay / Leave.
 *   fixit_arc_bay_conversation_2: Dave's text (Gearbox: "Knew it." … "Pip, pay up.").
 * Ember Bad Eden. globalThis.__arcLineDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__arcLineDry !== false;
  const SALE = "ans_fixit_arc_bay_anything_for_sale", STAB_Q = "quest_bSwOIWzxqNBwJ5NM";
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const conv = beats.find(b => b.id === "fixit_arc_bay_conversation"), c2 = beats.find(b => b.id === "fixit_arc_bay_conversation_2");
  const tmpl = beats.find(b => b.id === "ans_fixit_arc_bay_drink_the_coffee");
  if (!conv || !c2 || !tmpl) throw new Error("Arc Bay beats not found");
  let vendors = game.bbttcc.api.market.listVendors(); if (vendors?.then) vendors = await vendors;
  const vendor = (Array.isArray(vendors) ? vendors : Object.values(vendors || {})).find(v => v.name === "The Arc Bay");
  if (!vendor) throw new Error("vendor 'The Arc Bay' not found");

  const C2 = "Young Gearbox smiles. “Knew it,” he says, and lifts the corner of a nearby tarp. Underneath: a Leyline Stabilizer, the real thing (you tell yourself, confidently), humming faintly. He lets the tarp drop and points across the yard at the office. “Mara.”\n\nThen: “Pip, pay up.”\n\nThe young Jackalope reluctantly hands the mechanic a pile of Diplomacy marks.";
  if (c2.description !== C2) { c2.description = C2; report.changed.push("conversation_2: Dave's text"); }

  let sale = beats.find(b => b.id === SALE);
  if (!sale) {
    sale = foundry.utils.deepClone(tmpl);
    sale.id = SALE; sale.label = "Furrier's Fixit Farm — Arc Bay — Anything for sale?";
    sale.description = "Young Gearbox waves his mug at the whole bay. Everything that isn't bolted down has a tag on it. Some of the bolted-down things do too.";
    sale.inject = { ...(tmpl.inject || {}), repeatable: true, evergreen: true };
    sale.worldEffects = {};
    sale.choices = [
      { label: "Back to the bay.", next: "fixit_arc_bay_conversation", description: "", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Leave", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
    ];
    beats.push(sale); report.changed.push(`beat ${SALE} created`);
  }
  const om = { vendorId: vendor.id, vendorName: "The Arc Bay", note: "🛒 The Arc Bay — rigs, war machines, discounted air filters." };
  if (JSON.stringify(sale.worldEffects?.openMarket) !== JSON.stringify(om)) { sale.worldEffects = { ...(sale.worldEffects || {}), openMarket: om }; report.changed.push("sale: opens the Arc Bay Market"); }

  const forSale = conv.choices.find(ch => /^Anything for sale\?/.test(String(ch.label || "").trim()));
  if (forSale && forSale.next !== SALE) { forSale.next = SALE; report.changed.push("conversation: 'Anything for sale?' → the market"); }
  if (!conv.choices.some(ch => ch.next === "fixit_arc_bay_conversation_2" && /Stabilizer/i.test(ch.label))) {
    conv.choices.unshift({ label: "We're here about the Leyline Stabilizer.", next: "fixit_arc_bay_conversation_2", description: "", checkStat: "", checkDC: 0, failNext: "",
      requires: [{ questBucket: STAB_Q, isNot: "completed" }] });
    report.changed.push("conversation: 'We're here about the Leyline Stabilizer.' added first");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("ARCLINE " + JSON.stringify(report));
  return report;
})();
