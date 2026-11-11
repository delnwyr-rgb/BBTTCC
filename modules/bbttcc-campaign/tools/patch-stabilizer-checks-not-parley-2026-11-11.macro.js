/*
 * patch-stabilizer-checks-not-parley-2026-11-11.macro.js — Dave (2026-11-11): "kill the parley … go back to the regular beat
 * checks for the Leyline Stabilizer. Furriers has so many people in it, they are going to just always crush the stewards at
 * this point." Reverses patch-parley-to-stabilizer-2026-11-06 for the stabilizer (the Reliable lease Parley stays gone):
 *  - Trade: Persuasion (per) DC 14, fail → fixit_leyline_trade_fail (restored from the 11-05 golden), "Make a Persuasion check. Marks can back it."
 *  - Shared Oversight: Diplomacy (op.diplomacy) DC 14, fail → fixit_leyline_stabilizer_delay.
 *  - The Parley paragraph and teaching.parley tags leave the negotiation beat.
 *  - ans_fixit_stabilizer_parley_trade / _oversight retired (nothing routes to them; inject gated storyPhase ≥ 99).
 * Ember Bad Eden. globalThis.__stabDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__stabDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const get = (id) => beats.find(x => x.id === id);
  const FAIL = {"id": "fixit_leyline_trade_fail", "questId": "quest_bSwOIWzxqNBwJ5NM", "type": "dialog", "label": "Furrier's Fixit Farm - The Price Goes Up", "description": "You watched the wrong detail and named the wrong number, and the negotiation cools by exactly four degrees of neighborliness. Nothing is broken \u2014 this is still the Fixit Farm \u2014 but the stabilizer will not change hands on today's terms.", "choices": [{"label": "Fall back to shared oversight", "description": "Half a machine on good terms beats a whole machine on bad ones.", "checkStat": "op.diplomacy", "checkDC": 14, "next": "fixit_leyline_stabilizer_shared_oversight_success", "failNext": "fixit_leyline_stabilizer_delay"}, {"label": "Let it rest for today", "next": "fixit_leyline_stabilizer_delay"}], "tags": ["seeded-failure-2026-08-22"], "questStep": 80, "story": {"quest": "fixit_farm", "chapter": "the_leyline_stabilizer"}, "sceneId": "x4IJo7y7YyUkICxH", "inject": {"requires": [{"flag": "storyPhase", "gte": 2}]}, "speakerActorId": "GTX6S0gtzoJ7OeSE"};

  if (!get(FAIL.id)) { beats.push(FAIL); report.changed.push("trade fail beat restored"); }
  const neg = get("fixit_leyline_stabilizer_negotiation");
  if (!neg) throw new Error("negotiation beat missing");
  const tr = neg.choices.find(x => x.label === "Trade"), ov = neg.choices.find(x => x.label === "Shared Oversight");
  if (tr.next !== "fixit_leyline_stabilizer_trade_success") {
    Object.assign(tr, { next: "fixit_leyline_stabilizer_trade_success", checkStat: "per", checkDC: 14, failNext: FAIL.id });
    delete tr.worldEffects;
    if (!/Make a Persuasion check/.test(tr.description || "")) tr.description = String(tr.description || "").trimEnd() + "\n\nMake a Persuasion check. Marks can back it.";
    report.changed.push("Trade: Persuasion DC 14");
  }
  if (ov.next !== "fixit_leyline_stabilizer_shared_oversight_success") {
    Object.assign(ov, { next: "fixit_leyline_stabilizer_shared_oversight_success", checkStat: "op.diplomacy", checkDC: 14, failNext: "fixit_leyline_stabilizer_delay" });
    delete ov.worldEffects;
    report.changed.push("Shared Oversight: Diplomacy DC 14");
  }
  const P = neg.description.indexOf("\n\nThis is a Parley.");
  if (P >= 0) { neg.description = neg.description.slice(0, P); report.changed.push("negotiation: Parley paragraph removed"); }
  const tags = String(neg.tags || "").split(",").map(s => s.trim()).filter(t => t && t !== "teaching.parley" && t !== "alpha.teaching").join(",");
  if (tags !== String(neg.tags || "")) { neg.tags = tags; report.changed.push("negotiation: Parley tags removed"); }

  for (const id of ["ans_fixit_stabilizer_parley_trade", "ans_fixit_stabilizer_parley_oversight"]) {
    const b = get(id); if (!b) continue;
    b.dialogueOffer = false;
    b.inject = b.inject || {};
    const req = Array.isArray(b.inject.requires) ? b.inject.requires : [];
    if (!req.some(r => r?.flag === "storyPhase" && Number(r.gte) >= 99)) { b.inject.requires = [...req.filter(r => r?.flag !== "storyPhase"), { flag: "storyPhase", gte: 99 }]; report.changed.push(id + " retired"); }
  }
  const dangling = beats.filter(b => b.id !== "ans_fixit_stabilizer_parley_trade" && b.id !== "ans_fixit_stabilizer_parley_oversight")
    .filter(b => (b.choices || []).some(x => /^ans_fixit_stabilizer_parley_/.test(String(x.next || "")))).map(b => b.id);
  report.dangling = dangling;
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("STAB " + JSON.stringify(report));
  return report;
})();
