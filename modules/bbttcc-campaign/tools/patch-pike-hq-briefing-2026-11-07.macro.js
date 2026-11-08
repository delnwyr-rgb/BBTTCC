/*
 * patch-pike-hq-briefing-2026-11-07.macro.js — Dave 2026-11-07: "Checking in at HQ could provide a buff to defenses, or to attacks"
 * → "Let's have Pike's bonuses apply to the stewards. +1 to guard/evasion/resolve, or +1 to melee/ranged/unarmed attacks, including
 * manifestation and ability attack rolls." / "Anything that gets labeled a strike at the moment gets the bonus".
 *   • HQ door (allesh_gilliam_hq_cinematics) gains "Ask Pike for a briefing" (Act 2+) → ag_hq_briefing.
 *   • ag_hq_briefing: Dig in → ag_hq_briefing_dig_in (+1 Guard / Evasion / Resolve) · Plan the hit → ag_hq_briefing_plan_the_hit
 *     (+1 to every Strike and manifestation attack) · Not today.
 *   • Both buffs are worldEffects.partyEffects rows (every coalition Steward, until the month ends) in group "pike_briefing", so a
 *     Steward holds one briefing a month. Engine: WME defenseBonus/group/partyEffectsTitle + system passives.defenseBonus and the
 *     manifestation attack reading attack bonuses (same day).
 * Text is Claude's draft for Dave to polish. Ember Bad Eden. globalThis.__pikeBriefDry = false applies; anything else is a dry run.
 * Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__pikeBriefDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const HQ = beats.find(b => b.id === "allesh_gilliam_hq_cinematics");
  if (!HQ) throw new Error("allesh_gilliam_hq_cinematics not found");
  const ACT2 = [{ flag: "storyPhase", gte: 2 }];
  const TITLE = "Pike's briefing";

  // a clean beat in the HQ door's shape: no scene hop, no story role, no quest, repeatable
  const shell = (id, label, description, choices, worldEffects = {}) => {
    const b = foundry.utils.deepClone(HQ);
    Object.assign(b, { id, label, description, choices, tags: "", politicalTags: "", questId: "", questStep: "", questRole: "" });
    delete b.story; delete b.sceneId; delete b.digest;
    b.cinematic = { ...(b.cinematic || {}), enabled: false, startSceneId: "", nextSceneId: "" };
    b.inject = { ...(b.inject || {}), repeatable: true, evergreen: true, cooldownTurns: 0, requires: ACT2 };
    b.worldEffects = { ...Object.fromEntries(Object.entries(HQ.worldEffects || {}).map(([k, v]) => [k, Array.isArray(v) ? [] : (v && typeof v === "object") ? {} : v])), ...worldEffects };
    delete b.worldEffects.openMarket;
    return b;
  };
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", result: "", ...extra });

  const WANT = [
    shell("ag_hq_briefing", "Allesh-Gilliam — Pike's Briefing",
      "Pike clears a corner of the map table with one forearm. There's a pot of something brown, a pencil worn down to the ferrule, and ten minutes.\n\n\"Sit. Tell me what keeps you up at night. Something coming at you, or something you're going at?\"",
      [ch("Dig in", "ag_hq_briefing_dig_in", "\"Walk me through our walls.\""),
       ch("Plan the hit", "ag_hq_briefing_plan_the_hit", "\"Walk me through the target.\""),
       ch("Not today", "", "\"Another time, Marshal.\"")]),
    shell("ag_hq_briefing_dig_in", "Allesh-Gilliam — Pike's Briefing: Dig In",
      "Pike draws your lines in pencil, then makes you draw them again in ink. By the time the pot is empty, every one of you knows where to stand when it goes wrong, and who's standing next to you.",
      [ch("Thank the Marshal", "")],
      { partyEffectsTitle: TITLE, partyEffects: [{ name: "Pike's Briefing — Dug In", icon: "🛡️", img: "icons/equipment/shield/buckler-iron-cross-gray.webp",
        note: "+1 Guard, Evasion and Resolve until the month ends.", defenseBonus: { guard: 1, evasion: 1, resolve: 1 }, group: "pike_briefing", duration: "turn" }] }),
    shell("ag_hq_briefing_plan_the_hit", "Allesh-Gilliam — Pike's Briefing: Plan the Hit",
      "Pike turns the map so the target faces you. \"Here's where they're soft. Here's where they think they aren't.\" The pencil taps twice. \"Hit there. Then hit there again.\"",
      [ch("Thank the Marshal", "")],
      { partyEffectsTitle: TITLE, partyEffects: [{ name: "Pike's Briefing — The Hit", icon: "⚔️", img: "icons/tools/navigation/map-marked-red.webp",
        note: "+1 to every Strike and manifestation attack until the month ends.", checkBonus: [{ context: "attack", bonus: 1, note: "Pike's briefing" }], group: "pike_briefing", duration: "turn" }] })
  ];
  for (const w of WANT) {
    const i = beats.findIndex(b => b.id === w.id);
    if (i < 0) { beats.push(w); report.changed.push(`${w.id}: added`); }
    else if (JSON.stringify(beats[i]) !== JSON.stringify(w)) { beats[i] = w; report.changed.push(`${w.id}: updated`); }
  }
  const DOOR = ch("Ask Pike for a briefing", "ag_hq_briefing", "Ten minutes and a pencil.", { requires: ACT2 });
  const di = (HQ.choices || []).findIndex(x => x.next === "ag_hq_briefing");
  if (di < 0) { HQ.choices.push(DOOR); report.changed.push("HQ door: briefing choice added"); }
  else if (JSON.stringify(HQ.choices[di]) !== JSON.stringify(DOOR)) { HQ.choices[di] = DOOR; report.changed.push("HQ door: briefing choice updated"); }

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("PIKEBRIEF " + JSON.stringify(report));
  return report;
})();
