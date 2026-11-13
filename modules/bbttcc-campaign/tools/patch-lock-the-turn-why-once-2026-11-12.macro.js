/*
 * patch-lock-the-turn-why-once-2026-11-12.macro.js — Dave (2026-11-12), locking Month 2: "That was the beat associated with the
 * first turn advance. Probably shouldn't have it read the same thing each time."
 * ag_days_end's "Lock the turn. Run it." always led to ag_first_turn_why (the ledger's "This turn has a reason" lesson). Now two:
 *   • ag_first_turn_why not played yet → the lesson (unchanged)
 *   • played → just locks the turn (next "", result line) — the GM runs the Turn Driver, like days_end_thatwards
 * Ember Bad Eden. globalThis.__whyOnceDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__whyOnceDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "ag_days_end"); if (!b) throw new Error("ag_days_end missing");
  const LABEL = "Lock the turn. Run it.";
  const runs = (b.choices || []).filter(x => x.label === LABEL);
  const first = runs.find(x => x.next === "ag_first_turn_why");
  if (!first) throw new Error("the lesson choice is missing — not patching");
  const RIDE = { anyOf: [{ beatMark: "ag_ride_khezek_tor" }, { beatMark: "ag_ride_lyrenn" }] };
  const firstReq = [RIDE, { beatMark: "ag_first_turn_why", not: true }];
  if (JSON.stringify(first.requires) !== JSON.stringify(firstReq)) { first.requires = firstReq; report.changed.push("lesson choice: first time only"); }
  if (!runs.some(x => x.next === "")) {
    const i = b.choices.indexOf(first);
    b.choices.splice(i + 1, 0, { label: LABEL, next: "", description: "", checkStat: "", checkDC: 0, failNext: "",
      result: "The turn is locked. The world takes its turn.", requires: [RIDE, { beatMark: "ag_first_turn_why" }] });
    report.changed.push("plain lock choice added (after the first turn)");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("WHYONCE " + JSON.stringify(report));
  return report;
})();
