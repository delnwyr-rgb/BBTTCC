/*
 * patch-fixit-counter-market-2026-11-11.macro.js — Dave (2026-11-11): "NONE of these choices make sense anymore … we're just going to
 * turn this into the beat that unlocks the Fixit Farm Market. Mara did her roleplaying bits in the other two quests here."
 *  1. fixit_general_store_coversation (the Counter) takes Dave's text (typo: "know one knows" → "no one knows"; first sentence completed per Dave) and its three
 *     questions go (fixit_general_store_coversation_1/2/3 are unreachable now and kept).
 *  2. New answer beat ans_fixit_counter_shop (the Arc Bay "Anything for sale?" shape: dialog, repeatable, evergreen, Mara speaking,
 *     Counter interior): openMarket on Furrier's Fixit Farm with activate:true — the market switches ON and stays on (unlocked).
 *     Exits: Back to the Counter. / Leave.
 *  Counter choices: "Let's see what you've got." → the shop · "Back to the yard".
 * Ember Bad Eden. globalThis.__counterDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__counterDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const conv = beats.find(b => b.id === "fixit_general_store_coversation");
  const tmpl = beats.find(b => b.id === "ans_fixit_arc_bay_anything_for_sale");
  if (!conv || !tmpl) throw new Error("Counter or Arc Bay shop beat missing");
  const ch = (label, next) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" });

  const TEXT = [
    "The Counter is the town general store, and is named after the slab of reinforced metal worn smooth at the edges that runs down its center. It is famously impervious to harm, and no one knows why.",
    "This monument to ignorance has upon its surface a myriad of items for purchase. The walls also have stuff too.",
    "Mara Quickhands, in addition to acting in her official capacity as Lucky Chief, also runs The Counter.",
    "Mara Quickhands is steel that has been wrapped in velveteen, and then given several espressos.",
    "“Stewards! Can I help you find anything?”"
  ].join("\n\n");
  if (conv.description !== TEXT) { conv.description = TEXT; report.changed.push("Counter: Dave's text"); }

  const SHOP = "ans_fixit_counter_shop";
  let shop = beats.find(b => b.id === SHOP);
  if (!shop) {
    shop = foundry.utils.deepClone(tmpl);
    Object.assign(shop, {
      id: SHOP, label: "Furrier's Fixit Farm — The Counter — Shopping",
      description: "Mara sweeps a paw down the length of the Counter like a game-show host, then points at the walls, then at the Counter again, in case you missed it.",
      sceneId: conv.sceneId, speakerActorId: conv.speakerActorId, tags: "answer fixit",
      choices: [ch("Back to the Counter.", "fixit_general_store_coversation"), ch("Leave", "")]
    });
    shop.worldEffects = { ...(shop.worldEffects || {}), openMarket: { vendorId: "furriers-fixit-farm", vendorName: "Furrier's Fixit Farm", activate: true, note: "🛒 The Counter — Furrier's Fixit Farm's general store." } };
    beats.push(shop);
    report.changed.push("shop beat added");
  }

  const WANT = [ch("Let's see what you've got.", SHOP), ch("Back to the yard", "")];
  if (JSON.stringify((conv.choices || []).map(x => [x.label, x.next])) !== JSON.stringify(WANT.map(x => [x.label, x.next]))) {
    conv.choices = WANT; report.changed.push("Counter: choices = shop / back to the yard");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("COUNTER " + JSON.stringify(report));
  return report;
})();
