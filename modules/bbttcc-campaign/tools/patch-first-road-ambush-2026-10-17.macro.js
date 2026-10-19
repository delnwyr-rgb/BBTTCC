/* patch-first-road-ambush-2026-10-17.macro.js — TEACHING BEAT 1: BATTLE (Alpha Cut, Dave 2026-10-17:
 *  "Yes to all six teaching beats, start on the Battle one.")
 *
 *  Finding (why/when survey, 2026-10-17): no Act 0–1 beat calls for a Battle. Bandit Ambush sits on every
 *  travel table at phaseGte 2, so no fight can happen in Act 1 at all.
 *
 *  Fix: ONE pinned beat on the first ride. Allesh-Gilliam and Khezek-Tor are adjacent hexes, so the ride is a
 *  single leg; the travel injector's PINNED LEG rule (hex-travel.js, STORY FLOW D-9) fires a beat declaring
 *  `pinLeg = { from, to }` on exactly that leg, ahead of the table draw, once. The Khezek-Tor arrival beat
 *  follows after the fight settles (the arrival waits for the injected chain to go quiet).
 *
 *   NEW   first_road_ambush            type encounter (key bandit_ambush, tier 1) · pinLeg AG → KT · Act 1 only · fires once
 *                                      The card says what a Battle IS and what it costs — the "why and when".
 *                                      One choice: fight. (Words-before-weapons is the Act-2 generic ambush's trick.)
 *   NEW   first_road_ambush_results    GM picks Win / Bandits run / Run / Lose (the shared results beat is gated to Act 2)
 *                                      Win → enc_bandit_ambush_win (kill / jail / free — free founds the AG militia, which
 *                                      IS the right consequence on the AG road) · Bandits run → the shared beat
 *   NEW   first_road_ambush_run        broke through; the road stays theirs
 *   NEW   first_road_ambush_lose       woke at the gate lighter; coalition morale −1
 *
 *  Nothing else changes: the Act-2 table entries, the generic ambush and its outcome chain are untouched.
 *  Idempotent (id / text guards); DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [FIRST-ROAD-AMBUSH-2026-10-17]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const AMBUSH = "first_road_ambush", RESULTS = "first_road_ambush_results", RUN = "first_road_ambush_run", LOSE = "first_road_ambush_lose";
  const tmplAmbush  = byId.get("enc_bandit_ambush");
  const tmplResults = byId.get("bandit_ambush_outcome_results");
  const tmplTail    = byId.get("enc_bandit_ambush_bandits_run");
  if (!tmplAmbush || !tmplResults || !tmplTail) return ui.notifications.error("Bandit Ambush family not found — nothing to clone from.");

  const ACT1_ONLY = [{ flag: "storyPhase", gte: 1 }, { flag: "storyPhase", lte: 1 }];
  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });

  const AMBUSH_DESC =
    "\"Wow. You know,\" you say, \"this would be a great place for an ambush ...\"\n\n" +
    "From behind one of the glowing towers, a panicked voice: \"Wait — how did they know? Who told them?\"\n\n" +
    "Ah. Here we go. Spears first, questions never.\n\n" +
    "<b>This is a Battle.</b> Your tokens go on the map, theirs go on the map, and it runs in combat rounds until one side is done. The GM calls the aftermath.\n\n" +
    "<b>Win</b> and the road to Khezek-Tor is yours — plus whatever they were carrying, and a reputation that travels faster than you do. <b>Lose or run</b> and the road stays theirs, and your faction pays for it.";
  const AMBUSH_MEMORY = "Ambushed on the first ride to Khezek-Tor. Your first Battle.";
  const RUN_DESC =
    "You break off and ride hard for the smelter-glow. Khezek-Tor's gate takes you in with nothing lost but the road — which is still theirs, and will be until somebody does something about it.\n\n" +
    "Somebody is you. Later.";
  const RUN_MEMORY = "Ran from the first ambush. The road to Khezek-Tor is still theirs.";
  const LOSE_DESC =
    "You come to in a ditch with the smelter-glow for a ceiling and your packs the lighter for it. The bandits are gone, and so is the road toll they took in kind.\n\n" +
    "Khezek-Tor's gate is a walk away. Nobody rides in looking like that twice.";
  const LOSE_MEMORY = "Lost the first ambush. The bandits took their toll; the coalition noticed.";

  const upsert = (id, build, label) => {
    const have = byId.get(id);
    const want = build();
    if (!have) { camp.beats.push(want); byId.set(id, want); changes++; report.push(`✚ beat ${id} — ${label}`); return want; }
    // Refresh the authored fields only; leave anything the owner may have edited by hand alone unless it is the teaching text.
    let touched = 0;
    for (const k of ["description", "memoryText", "choices", "inject", "pinLeg", "worldEffects", "label", "questStep"]) {
      if (JSON.stringify(have[k]) !== JSON.stringify(want[k])) { have[k] = want[k]; touched++; }
    }
    if (touched) { changes++; report.push(`✚ beat ${id}: ${touched} field(s) refreshed`); } else report.push(`· ok beat ${id}`);
    return have;
  };

  /* ── 1. the ambush, pinned to the first ride ─────────────────────────────── */
  upsert(AMBUSH, () => {
    const nb = foundry.utils.deepClone(tmplAmbush);
    Object.assign(nb, {
      id: AMBUSH, label: "The Road Thatwards-by-North — Ambush", type: "encounter",
      description: AMBUSH_DESC, memoryText: AMBUSH_MEMORY,
      encounter: { key: "bandit_ambush", tier: 1, actorName: null },
      scene: { uuid: "" },
      tags: "allesh_gilliam prologue spine travel teaching battle",
      questId: tmplAmbush.questId || "quest_travel_encounters", questStep: 452, timePoints: 0,
      pinLeg: { from: "Allesh-Gilliam", to: "Khezek-Tor" },
      worldEffects: WE(),
      choices: [
        ch("Steel it is — spring their ambush back at them", "They picked the ground; you pick the tempo. Fight it out on the map — the GM calls the aftermath (win, rout, or worse) when it's done.", { next: RESULTS })
      ]
    });
    nb.inject = { ...(nb.inject || {}), repeatable: false, cooldownTurns: 0, oncePerHex: false, requires: ACT1_ONLY };
    return nb;
  }, "the first Battle, pinned to the ride Allesh-Gilliam → Khezek-Tor");

  /* ── 2. the GM's aftermath pick (Act-1 copy; the shared one is gated to Act 2) ── */
  upsert(RESULTS, () => {
    const nb = foundry.utils.deepClone(tmplResults);
    Object.assign(nb, {
      id: RESULTS, label: "First Road Ambush — Aftermath", type: "outcome_trigger", questStep: 453, timePoints: 0,
      description: "", worldEffects: WE(),
      choices: [
        ch("Win", "", { next: "enc_bandit_ambush_win" }),
        ch("Bandits run", "", { next: "enc_bandit_ambush_bandits_run" }),
        ch("Run", "", { next: RUN }),
        ch("Lose", "", { next: LOSE })
      ]
    });
    nb.inject = { ...(nb.inject || {}), repeatable: true }; delete nb.inject.requires;
    return nb;
  }, "GM picks Win / Bandits run / Run / Lose");

  /* ── 3. the two tails the shared chain does not have for Act 1 ──────────── */
  upsert(RUN, () => {
    const nb = foundry.utils.deepClone(tmplTail);
    Object.assign(nb, { id: RUN, label: "First Road Ambush — Broke Through", type: "outcome_trigger", questStep: 454, timePoints: 0,
      description: RUN_DESC, memoryText: RUN_MEMORY, worldEffects: WE(), choices: [ch("Continue", "")] });
    nb.inject = { ...(nb.inject || {}), repeatable: true }; delete nb.inject.requires; delete nb.award;
    return nb;
  }, "ran; the road stays theirs");
  upsert(LOSE, () => {
    const nb = foundry.utils.deepClone(tmplTail);
    Object.assign(nb, { id: LOSE, label: "First Road Ambush — The Toll", type: "outcome_trigger", questStep: 455, timePoints: 0,
      description: LOSE_DESC, memoryText: LOSE_MEMORY,
      worldEffects: WE({ factionEffects: [{ factionId: "@coalition", moraleDelta: -1, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }] }),
      choices: [ch("Continue", "")] });
    nb.inject = { ...(nb.inject || {}), repeatable: true }; delete nb.inject.requires; delete nb.award;
    return nb;
  }, "lost; coalition morale −1");

  /* ── sanity: the shared beats we hand off to must exist and be reachable in Act 1 ── */
  for (const id of ["enc_bandit_ambush_win", "enc_bandit_ambush_bandits_run", "enc_bandit_ambush_win_kill", "enc_bandit_ambush_win_jail", "enc_bandit_ambush_win_free"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    const sp = (b.inject?.requires || []).find(r => r && String(r.flag) === "storyPhase" && Number(r.gte) >= 2);
    if (sp) report.push(`⚠ ${id}: gated storyPhase >= ${sp.gte} — the Act-1 chain would stall here`);
  }

  console.log(`[patch-first-road-ambush] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`First Road Ambush DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("First Road Ambush: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-first-road-ambush-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`First Road Ambush APPLIED: ${changes} change(s). The first ride to Khezek-Tor is now a Battle.`);
})();
