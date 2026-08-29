/* patch-no-exit-menus.macro.js — UNCHECKED EXITS for the six caged menus
 * (2026-08-28, from the audit-beat-links live run: 0 broken links, 6 menus
 * where EVERY choice is checked → a failed roll re-offers the same trap).
 *
 * Doctrine: every checked menu needs an unchecked exit — but the exit must
 * never be strictly better than rolling:
 *  · HAZARDS (acid bog, broken bridge, wilderness push) — the exit is the
 *    slow, guaranteed, miserable lane: a new outcome beat costing
 *    timePoints: 1 (a real Turn Ledger day). Not rolling costs time.
 *  · GILBERT — the exit is the fight that already exists
 *    (gilbert_theater_fight); talk collapses into the hard way.
 *  · SOCIAL/MAP menus (Port Kudzu intro, Lyrenn's teach) — walking away is
 *    genuinely free: unchecked exit, no route, no cost.
 * BONUS: retargets the bandit steel door → the live neutral hub
 * `bandit_ambush_outcome_results` (Win/Bandits Run/Lose/Run — the audit found
 * it; the steel-doors patch didn't know it existed).
 *
 * Idempotent (label-guarded; new beats skipped if present); DRY_RUN default
 * true; backs up campaigns before writing. Run as GM.
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

  const mkOutcome = (id, label, description, { timePoints = 0, memoryText = null } = {}) => ({
    id, label,
    type: "outcome_trigger",
    timeScale: "leg", timePoints,
    tags: "travel words_door slow_lane",
    politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false,
              promptGM: "inherit", fallbackOnDecline: "inherit",
              allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [], refs: {},
    choices: [{ label: "Onward", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    description,
    ...(memoryText ? { memoryText } : {}),
    playerFacing: true
  });

  // ── new slow-lane outcome beats (hazards pay in TIME) ─────────────────────
  const NEW_BEATS = [
    mkOutcome("enc_acid_bog_slog", "Acid Bog — The Long Slog",
      "No cleverness, no shortcuts — boots, rope, planks, and a full day of profanity conducted at a professional level. The bog takes its toll the honest way: etched bootsoles, one ruined tarp, and the specific smell that will live in the rig's upholstery until further notice. But nobody rolled anything, nobody bled, and by dusk you are, undeniably, on the other side.",
      { timePoints: 1, memoryText: "The party slogged the acid bog the slow, safe, miserable way — a full day lost, nothing worse." }),
    mkOutcome("enc_broken_bridge_long_way", "Broken Bridge — The Long Way Around",
      "The bridge stays broken and you stay intact — that's the trade. The detour follows the gorge until it forgets to be a gorge, which takes most of a day and all of the snacks. Somewhere along the rim, someone points out you can still SEE the bridge from here. This observation is received poorly.",
      { timePoints: 1, memoryText: "The party took the long way around the broken bridge — a day spent instead of a risk taken." }),
    mkOutcome("enc_wilderness_push_turn_back", "Wilderness Push — The Green Wins Today",
      "You read the wall of it — the roots in the roadbed, the vines with opinions, the canopy closing like a slow committee vote — and you make the veteran's call: not today. The land gets to keep what it took, for now, and you spend the day backtracking to a route the world hasn't finished eating. The green does not gloat. It doesn't need to. It'll be a mile wider next season.",
      { timePoints: 1, memoryText: "The party turned back from the wilderness push — a day lost to the land that's taking the roads back." })
  ];

  for (const nb of NEW_BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id} (timePoints ${nb.timePoints})`);
  }

  // ── unchecked exits onto the six caged menus ──────────────────────────────
  const EXITS = [
    { intro: "enc_acid_bog",
      label: "Slog straight through — pay the bog's toll",
      description: "No roll, no risk, no dignity: planks and rope and a lost day. The slow lane always goes through.",
      next: "enc_acid_bog_slog" },
    { intro: "enc_broken_bridge",
      label: "The long way around — spend the day",
      description: "The safe answer. It costs exactly what safe answers cost: time.",
      next: "enc_broken_bridge_long_way" },
    { intro: "enc_wilderness_push",
      label: "Turn back — find a road the green hasn't eaten",
      description: "Retreat is a maneuver. A slow one. The day goes to the detour.",
      next: "enc_wilderness_push_turn_back" },
    { intro: "gilbert_theater_parley",
      label: "Enough talk — the hard way",
      description: "The conversation ends the way conversations with demons sometimes do.",
      next: "gilbert_theater_fight", requireTarget: true },
    { intro: "map_port_kudzu_intro",
      label: "Just look around — hands visible, questions later",
      description: "No commitments. Walk the port, read the room, come back to this when you know more.",
      next: "" },
    { intro: "lyrenn_the_gentle_pest_teach",
      label: "Not today — wave and move on",
      description: "The lesson keeps. Lyrenn's patience is geological.",
      next: "" }
  ];

  for (const x of EXITS) {
    const intro = byId.get(x.intro);
    if (!intro) { report.push(`⚠ ${x.intro}: NOT FOUND — skipped`); continue; }
    intro.choices = Array.isArray(intro.choices) ? intro.choices : [];
    if (intro.choices.some(c => String(c?.label || "") === x.label)) {
      report.push(`· ok (already) exit on ${x.intro}`); continue;
    }
    if (intro.choices.some(c => !String(c?.checkStat || "").trim())) {
      report.push(`· ok ${x.intro}: already has an unchecked choice — not adding`); continue;
    }
    let next = x.next;
    if (x.requireTarget && next && !byId.get(next)) {
      report.push(`⚠ ${x.intro}: target '${next}' missing — exit added with no route`);
      next = "";
    }
    intro.choices.push({ label: x.label, next, description: x.description, checkStat: "", checkDC: 0, failNext: "" });
    changes++; report.push(`✚ exit on ${x.intro} → ${next || "(end)"}`);
  }

  // ── bandit steel door → the live neutral hub the audit found ──────────────
  {
    const intro = byId.get("enc_bandit_ambush");
    const hub = byId.get("bandit_ambush_outcome_results");
    if (intro && hub && Array.isArray(hub.choices) && hub.choices.length >= 2) {
      const steel = (intro.choices || []).find(c => /Steel it is/i.test(String(c?.label || "")));
      if (!steel) report.push("⚠ bandit: steel door not found — run patch-steel-doors first");
      else if (String(steel.next || "").trim() === "bandit_ambush_outcome_results") report.push("· ok bandit steel door already → hub");
      else { steel.next = "bandit_ambush_outcome_results"; changes++; report.push("✚ bandit steel door retargeted → bandit_ambush_outcome_results (Win/Bandits Run/Lose/Run)"); }
    } else report.push("⚠ bandit hub 'bandit_ambush_outcome_results' not found/neutral — steel door left as-is");
  }

  console.log(`[patch-no-exit-menus] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`No-exit menus DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("No-exit menus: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-no-exit-menus-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`No-exit menus APPLIED: ${changes} change(s). Every cage has a door now.`);
})();
