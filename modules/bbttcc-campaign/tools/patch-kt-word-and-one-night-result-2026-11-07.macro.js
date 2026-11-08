/*
 * patch-kt-word-and-one-night-result-2026-11-07.macro.js — Dave 2026-11-07:
 *   • Khezek-Tor's "Word from the Mountain" Next: "Sable Nine and Drax Calder have both written asking for you. Ride to
 *     Khezek-Tor." (hereLine follows Lyrenn's pattern for when the party is already there).
 *   • a2_that_one_night: "Then a week later, things start going wrong everywhere." moves out of the card and becomes the
 *     "Let's start the plot" button's result (it replaces the old "By morning the words start arriving…" line).
 * Ember Bad Eden. globalThis.__ktWordDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__ktWordDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats), story = foundry.utils.deepClone(c.story || {});
  const LINE = "Sable Nine and Drax Calder have both written asking for you. Ride to Khezek-Tor.";
  const HERE = "Sable Nine and Drax Calder have both written asking for you. You're in Khezek-Tor already, so go and find them.";
  const st = (story.scripts?.khezek_tor?.steps || []).find(s => s.id === "word");
  if (!st) throw new Error("khezek_tor word step not found");
  if (st.line !== LINE) { st.line = LINE; report.changed.push("KT word line"); }
  if (st.hereLine !== HERE) { st.hereLine = HERE; report.changed.push("KT word hereLine"); }
  const RESULT = "Then a week later, things start going wrong everywhere.";
  const b = beats.find(x => x.id === "a2_that_one_night"); if (!b) throw new Error("a2_that_one_night not found");
  const tail = "\n\n" + RESULT;
  if (String(b.description).endsWith(tail)) { b.description = b.description.slice(0, -tail.length); report.changed.push("One Night: last line moved out"); }
  const ch = (b.choices || []).find(x => x.label === "Let's start the plot");
  if (!ch) throw new Error("Let's start the plot not found");
  if (ch.result !== RESULT) { ch.result = RESULT; report.changed.push("One Night: button result"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats, story });
  console.log("KTWORD " + JSON.stringify(report));
  return report;
})();
