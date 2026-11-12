/*
 * patch-gully-welcome-polish-2026-11-11.macro.js — Dave (2026-11-11), beat polish at the Gullywasher:
 *  1. fixit_gullywasher_welcome, first-visit text: after "…bingo card this morning." Dave's text replaces the house-rule speech and
 *     the room paragraph (typos fixed: "unphased" → "unfazed", the missing opening quote on the third round, one stray comma).
 *     The return-visit spans ({{#mark rc_gully_amber}} / {{#played rc_gully_soured}}) are untouched.
 *  2. "Drink — and keep where you're from to yourself" shows only AFTER "Drink the amber thing" (beside "Second round. Tell him
 *     where you're from."), so the second round is the decision: requires rc_gully_amber played, second round and soured not.
 * Ember Bad Eden. globalThis.__gullyDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__gullyDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const w = beats.find(b => b.id === "fixit_gullywasher_welcome");
  if (!w) throw new Error("welcome beat missing");
  const NEW = [
    "He acknowledges your confusion with a wry grin.",
    "Before you can begin to speak, there is a glass full of something amber, and fizzy, and aggressive.",
    "“You are clearly the new Stewards, and you are ADORABLE. Welcome to the Gullywasher.",
    "First round is on me, gratis.",
    "Second round, ALSO on me, but with a string attached. You tell me where you’re from. This time.” He winks knowingly.",
    "“Third round, because good things come in threes, YOU buy, and I tell you where I’M from. I’m very interesting.”",
    "The off-shift Jackalopes and rig drivers sitting about chatting in a low murmur seem unfazed.",
    "They’ve clearly seen this act before.",
    "That makes you feel both better and worse at the same time."
  ].join("\n\n");
  const d = String(w.description || "");
  const a = d.indexOf("He clocks your face"), z = d.indexOf("{{/played}}", a);
  if (a >= 0 && z > a) { w.description = d.slice(0, a) + NEW + d.slice(z); report.changed.push("welcome: Dave's text"); }
  else if (!d.includes("He acknowledges your confusion")) throw new Error("welcome text anchors not found");
  const keep = (w.choices || []).find(x => x.label === "Drink — and keep where you're from to yourself");
  if (!keep) throw new Error("keep-it-to-yourself choice missing");
  const REQ = [{ beatMark: "rc_gully_amber" }, { beatMark: "rc_gully_second_round", not: true }, { beatMark: "rc_gully_soured", not: true }];
  if (JSON.stringify(keep.requires) !== JSON.stringify(REQ)) { keep.requires = REQ; report.changed.push("keep-it-to-yourself: after the amber thing"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("GULLY " + JSON.stringify(report));
  return report;
})();
