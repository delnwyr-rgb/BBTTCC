/*
 * patch-fixit-garren-says-hi-2026-11-10.macro.js — Dave at Arc Bay (2026-11-10): Garren's Leygate line ("Tell YG I said hi. Tell
 * me if he says hi back. I have a bet with Pike.") had no payoff — "Yes, add the Garren says hi choice."
 *   fixit_arc_bay_conversation gains "Garren says hi." → ans_fixit_arc_bay_garren_says_hi:
 *     requires ag_leygate_visit played (you've met Garren); once — the spent-choice system greys it ✓ after (never hidden);
 *     withItem tetrarch_spanner (the button reads "— with the Tetrarch Spanner" while someone carries it).
 *   The answer beat is a clone of ans_fixit_arc_bay_drink_the_coffee's shape (dialog, Arc Bay scene, Young Gearbox speaking,
 *   exits "Back to the bay." / "Leave"), once-only. Its played mark is the record Garren's bet can read later.
 * Ember Bad Eden. globalThis.__garrenHiDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__garrenHiDry !== false;
  const ID = "ans_fixit_arc_bay_garren_says_hi";
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const conv = beats.find(b => b.id === "fixit_arc_bay_conversation"), tmpl = beats.find(b => b.id === "ans_fixit_arc_bay_drink_the_coffee");
  if (!conv || !tmpl) throw new Error("Arc Bay conversation / coffee answer not found");

  const TEXT = "Young Gearbox stops mid-sip. He looks at the Tetrarch Spanner for a long moment, the way you'd look at a dog you used to own. Then he sets his mug down, takes a grease pencil from behind his ear, and writes HI on the tarp in letters a foot tall. He underlines it twice. He picks his mug back up. That's more words than he's put anywhere this month. Garren is going to be insufferable.";
  let ans = beats.find(b => b.id === ID);
  if (!ans) {
    ans = foundry.utils.deepClone(tmpl);
    ans.id = ID;
    ans.label = "Furrier's Fixit Farm — Arc Bay — Garren says hi";
    ans.description = TEXT;
    ans.inject = { ...(tmpl.inject || {}), repeatable: false, evergreen: false };
    ans.worldEffects = {};
    ans.choices = [
      { label: "Back to the bay.", next: "fixit_arc_bay_conversation", description: "", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Leave", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
    ];
    beats.push(ans);
    report.changed.push(`beat ${ID} created`);
  }
  if (!conv.choices.some(ch => ch.next === ID)) {
    const at = Math.max(0, conv.choices.findIndex(ch => /^Leave$/.test(String(ch.label || "").trim())));
    conv.choices.splice(at, 0, {
      label: "Garren says hi.", next: ID, description: "", checkStat: "", checkDC: 0, failNext: "",
      withItem: "tetrarch_spanner",
      requires: [{ beatMark: "ag_leygate_visit" }]
    });
    report.changed.push("conversation: 'Garren says hi.' added before Leave");
  }
  // Universal greying (Dave 2026-10-30, again 11-10): a once-only choice stays on the menu, greyed ✓ — never hidden. The answer beat
  // is non-repeatable, so _choiceSpent locks it; a "not played" requires (the first version) hid it instead.
  for (const ch of conv.choices) if (ch.next === ID && Array.isArray(ch.requires) && ch.requires.some(r => r?.beatMark === ID && r.not)) {
    ch.requires = ch.requires.filter(r => !(r?.beatMark === ID && r.not));
    report.changed.push("conversation: 'Garren says hi.' greys after use instead of hiding");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("GARRENHI " + JSON.stringify(report));
  return report;
})();
