/*
 * patch-gullywasher-no-name-game-2026-11-11.macro.js — Dave (2026-11-11): "Let's remove the name guessing game. If they refuse to
 * participate he tells them his name anyway, but they don't get the bonus from the interaction. The reason for this beat is to
 * introduce The Gullywasher and Dougan as a character, seed the idea of the Jackalope and Chupacabra hostilities seem to be frozen,
 * and open the bar to the PCs … This has a lot of scaffolding from old drafts." His real name is Dougan (Marsh); "Gully" is only
 * what Miliard calls him (the Weeping Prisoner beats keep it), and the shop + drink names keep it on purpose.
 *  1. "Ask his name" leaves the welcome menu, the amber thing and the second round. fixit_gully_answer_name and
 *     rc_gully_getting_there (the guessing game) are unreachable now and kept.
 *  2. The third round gives the name plainly (no "behind the bar it's Gully", no on-account branch, no "use it sparingly").
 *  3. Keeping where you're from to yourself (rc_gully_soured): he tells you his name anyway. Its effects are unchanged.
 *  4. Narration says "he" / "the bartender" where it said Gully: welcome return lines, war fail, stabilizer answer + fail,
 *     second round, soured, Gully-Points-the-Way, and the late-run road's result line.
 * Ember Bad Eden. globalThis.__nameDry = false applies; else dry run. Idempotent (each edit checks its old text).
 */
(async () => {
  const DRY_RUN = globalThis.__nameDry !== false;
  const report = { DRY_RUN, changed: [], missed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const get = (id) => { const b = beats.find(x => x.id === id); if (!b) throw new Error(id + " missing"); return b; };
  const rep = (id, oldS, newS, field = "description") => {
    const b = get(id);
    if (String(b[field] || "").includes(newS)) return;   // already applied (newS may contain oldS)
    if (!String(b[field] || "").includes(oldS)) { report.missed.push(`${id}: "${oldS.slice(0, 40)}"`); return; }
    b[field] = String(b[field]).split(oldS).join(newS);
    report.changed.push(`${id}: ${oldS.slice(0, 30)}…`);
  };

  // 1 — no "Ask his name"
  for (const id of ["fixit_gullywasher_welcome", "rc_gully_amber", "rc_gully_second_round"]) {
    const b = get(id); const n = (b.choices || []).length;
    b.choices = (b.choices || []).filter(x => x.label !== "Ask his name");
    if (b.choices.length !== n) report.changed.push(`${id}: Ask his name removed`);
  }

  // 2 — third round
  const OLD3 = "{{#played gullywasher_gully_points_to_confluence}}“Dougan. You have that one already, darling — on account. Consider the advance paid off.”{{else}}“Dougan. Dougan Marsh. Behind the bar it's still Gully — but you're not behind the bar, are you.”{{/played}} He adjusts a cufflink that did not need adjusting. “Use it sparingly, darling. It's not a bottle one opens for the room.”";
  rep("rc_gully_third_round", OLD3, "“Dougan. Dougan Marsh.” He adjusts a cufflink that did not need adjusting.");

  // 3 + 4 — soured
  rep("rc_gully_soured", "Gully slides the second one down the bar", "He slides the second one down the bar");
  rep("rc_gully_soured", "Gully takes the second glass.", "He takes the second glass.");
  rep("rc_gully_soured", "I don't sell gossip and I don't give away seconds; I curate.”",
    "I don't sell gossip and I don't give away seconds; I curate.” A beat. “Dougan, by the way. Dougan Marsh. You'd have had it for the price of a story.”");

  // 4 — he / the bartender
  rep("fixit_gullywasher_welcome", "Gully is behind the bar, washing a glass that was already clean, which is where Gully is.",
    "He is behind the bar, washing a glass that was already clean, which is where he always is.");
  rep("fixit_gullywasher_choice_1_fail", "Gully laughs, musically", "He laughs, musically");
  rep("fixit_gullywasher_choice_4", "Gully lets you finish", "He lets you finish");
  rep("fixit_gullywasher_choice_4_fail", "Gully raises one brow", "He raises one brow");
  rep("rc_gully_second_round", "When you finish, Gully sets the glass down", "When you finish, he sets the glass down");
  rep("gullywasher_gully_points_to_confluence", "Gully stops polishing the glass.", "He stops polishing the glass.");
  const road = get("fixit_late_run_road");
  const rc = (road.choices || []).find(x => x.label === "Stop for a drink in his honour. Several.");
  if (rc && String(rc.result || "").includes("Gully pours one")) { rc.result = rc.result.replace("Gully pours one", "The bartender pours one"); report.changed.push("fixit_late_run_road: result line"); }

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("NAMEGAME " + JSON.stringify(report));
  return report;
})();
