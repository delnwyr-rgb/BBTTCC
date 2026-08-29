/* patch-steel-doors.macro.js — THE STEEL DOOR beside every words-door (2026-08-28)
 * Owner report from the Apex ride: the seeded parley door was the intro menu's
 * ONLY choice, so a failed check looped (fail beat → re-offer → same single
 * door) and the combat lane (fight on the battlemap → GM fires the family's
 * outcome beats) was invisible. Fix: every worded intro gets an explicit
 * no-check FIGHT choice.
 *
 * Routing rule: if the family has a NEUTRAL outcomes hub (a beat whose menu is
 * Win/Lose/Run-style, ≥2 choices — e.g. apex_predator_outcome), the steel door
 * routes to it: the hub dialog opens and WAITS while the fight happens on the
 * map; the GM picks the result when the dust settles. Families without a
 * neutral hub get next:"" — the menu closes, combat proceeds, the GM fires the
 * right outcome beat afterward (bandit's win/lose/run singles are NOT neutral —
 * routing to one would presume the result).
 *
 * Idempotent (skips intros that already have a no-check non-door choice or our
 * label); DRY_RUN default true; backs up campaigns before writing. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // { intro, label, description, hubCandidates: [ids] }
  const STEEL = [
    { intro: "enc_bandit_ambush",
      label: "Steel it is — spring their ambush back at them",
      description: "They picked the ground; you pick the tempo. Fight it out on the map — the GM calls the aftermath (win, rout, or worse) when it's done.",
      hubCandidates: [] },
    { intro: "enc_raider_raze_team",
      label: "No deal — put the torches out yourselves",
      description: "The contract meets its cancellation clause after all: you. Fight it out — the GM calls the aftermath when it's done.",
      hubCandidates: ["enc_raider_raze_team_outcome", "enc_raider_raze_team_outcomes", "raider_raze_team_outcome"] },
    { intro: "enc_mutant_wildlife_t2",
      label: "Weapons up — drive the pack off",
      description: "Some conversations are had with noise and fire. Fight on the map — the GM calls the result after.",
      hubCandidates: ["enc_mutant_wildlife_t2_outcomes", "enc_mutant_wildlife_t2_outcome", "mutant_wildlife_t2_outcome"] },
    { intro: "enc_mutant_wildlife_t3",
      label: "Weapons up — this one has to learn",
      description: "Smart enough to double-check you means smart enough to remember losing. Fight — the GM calls the result after.",
      hubCandidates: ["enc_mutant_wildlife_t3_outcomes", "enc_mutant_wildlife_t3_outcome", "mutant_wildlife_t3_outcome"] },
    { intro: "enc_apex_predator",
      label: "Meet it — steel, fire, and no apologies",
      description: "The oldest treaty has a second clause: sometimes the meal fights back. Battle on the map — pick the result here when it's decided.",
      hubCandidates: ["apex_predator_outcome", "enc_apex_predator_outcome"] },
    { intro: "enc_qlipothic_shambler",
      label: "No stillness today — cut it down",
      description: "Emptiness can be dispersed the loud way. Fight — the GM calls the result after.",
      hubCandidates: ["enc_qlipothic_shambler_outcomes", "enc_qlipothic_shambler_outcome", "qlipothic_shambler_outcome"] },
    { intro: "enc_slippage_wraith",
      label: "Enough grief — disperse it by force",
      description: "Not every loss can be named today. Fight — the GM calls the result after.",
      hubCandidates: ["enc_slippage_wraith_outcomes", "enc_slippage_wraith_outcome", "slippage_wraith_outcome"] },
    { intro: "enc_geometry_serpent",
      label: "Brute-force the proof — break the angles",
      description: "QED by ordnance. Fight — the GM calls the result after.",
      hubCandidates: ["enc_geometry_serpent_outcomes", "enc_geometry_serpent_outcome", "geometry_serpent_outcome"] },
    { intro: "enc_qliphotic_whorl",
      label: "Punch through — speed, armor, and nerve",
      description: "No rite, no address — force the passage and pay what it costs. The GM calls the toll after.",
      hubCandidates: ["enc_qliphotic_whorl_outcomes", "enc_qliphotic_whorl_outcome", "qliphotic_whorl_outcome"] },
    { intro: "enc_desenitarius_maarg",
      label: "Run the gauntlet — outlive its attention",
      description: "You do not fight the weather; you survive it with style. Scatter, endure, regroup — the GM calls the cost after.",
      hubCandidates: ["enc_desenitarius_maarg_outcomes", "enc_desenitarius_maarg_outcome", "desenitarius_maarg_outcome"] }
  ];

  const isDoorChoice = (c) => /words|parley|hail|read you|stand tall|stillness|what it lost|angles|rite|courtesies/i.test(String(c?.label || "")) && String(c?.checkStat || "").trim();

  for (const s of STEEL) {
    const intro = byId.get(s.intro);
    if (!intro) { report.push(`⚠ ${s.intro}: NOT FOUND — skipped`); continue; }
    intro.choices = Array.isArray(intro.choices) ? intro.choices : [];

    if (intro.choices.some(c => String(c?.label || "") === s.label)) {
      report.push(`· ok (already) steel door on ${s.intro}`); continue;
    }
    // A pre-existing no-check exit choice (authored fight/continue lane) also counts.
    const hasSteel = intro.choices.some(c => !String(c?.checkStat || "").trim() && !isDoorChoice(c));
    if (hasSteel) { report.push(`· ok ${s.intro}: has a no-check exit choice already — not adding another`); continue; }

    // Neutral hub: exists AND presents ≥2 choices (Win/Lose/Run-style).
    let hubId = "";
    for (const h of s.hubCandidates) {
      const hub = byId.get(h);
      if (hub && Array.isArray(hub.choices) && hub.choices.length >= 2) { hubId = h; break; }
    }

    intro.choices.push({
      label: s.label, next: hubId, description: s.description,
      checkStat: "", checkDC: 0, failNext: ""
    });
    changes++;
    report.push(`✚ steel door on ${s.intro}${hubId ? ` → hub '${hubId}' (opens, waits for the verdict)` : " (no neutral hub — GM fires the outcome beat after combat)"}`);
  }

  console.log(`[patch-steel-doors] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Steel doors DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Steel doors: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-steel-doors-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Steel doors APPLIED: ${changes} change(s). Words or steel — the choice is real now.`);
})();
