/*
 * patch-cr-parley-opening-text-2026-11-13.macro.js — Dave (2026-11-13), updated intro beat for the Circuit Riders Parley
 * (enc_circuit_riders_parley_opening). Text only; the five choices are unchanged.
 * Typo fixed: the robot's last line opened with a curly “ and closed with a straight " — now closes with ”.
 * Ember Bad Eden. globalThis.__crOpenDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__crOpenDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "enc_circuit_riders_parley_opening"); if (!b) throw new Error("enc_circuit_riders_parley_opening missing");
  const TEXT = [
    "You approach.",
    "They do not attack.",
    "You do not attack.",
    "This is a great step one.",
    "From the frantic, staticky chattering emanating from the group, who introduce themselves as Howard, Arviind, Simone, and Dennis, you gather that they are called the Circuit Riders.",
    "And they are trying to measure the reality of Reality.",
    "They are discouraged.",
    "They quiet as their ranks part, and out from among them steps what is CLEARLY a middle aged Human wearing a robot costume.",
    "“FEAR NOT CITIZENS! DO NOT BE ALARMED! WE MEAN YOU NO HARM. WE MERELY WISH TO EXAMINE YOU FOR INFORMATION.”",
    "Silence. Then Simone coughs.",
    "“Oh oh, umm. BLEEP BLEEP BLOOP BLORP.”"
  ].join("\n\n");
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("CROPEN " + JSON.stringify(report));
  return report;
})();
