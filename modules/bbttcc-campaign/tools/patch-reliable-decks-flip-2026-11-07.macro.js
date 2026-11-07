/*
 * patch-reliable-decks-flip-2026-11-07.macro.js — Dave flipped the Reliable's levels: living quarters on top (hM1o5Wlfw5PrztCU), engine room below (bi4IZQVrL3Ltuqd2).
 * Scene assignments don't change. The hub's door and the lower card's title and way back now say so. Replaces the deck names in patch-reliable-maps-2026-11-06.
 * Ember Bad Eden. globalThis.__reliableDecksDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__reliableDecksDry !== false, report = { DRY_RUN, text: [] };
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats);
  const hub = beats.find(b => b.id === "reliable_aboard"), low = beats.find(b => b.id === "reliable_helm");
  if (!hub || !low) throw new Error("Reliable beats not found");
  const door = (hub.choices || []).find(x => x.next === "reliable_helm"), back = (low.choices || []).find(x => x.next === "reliable_aboard");
  if (!door || !back) throw new Error("Reliable choices not found");
  const set = (o, k, v, tag) => { if (o[k] !== v) { report.text.push(`${tag}: ${o[k]} -> ${v}`); o[k] = v; } };
  set(door, "label", "Down to the engine room", "hub door");
  set(low, "label", "The Absolutely Reliable — The Engine Room", "lower card");
  set(back, "label", "Back up through the ship", "way back");
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  console.log("RELIABLEDECKS " + JSON.stringify(report));
})();
