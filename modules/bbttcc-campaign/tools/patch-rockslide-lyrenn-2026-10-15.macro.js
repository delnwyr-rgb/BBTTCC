/* patch-rockslide-lyrenn-2026-10-15.macro.js — two findings from the 2026-10-15
 * campaign sweep (the one that caught the Broken Bridge + Geometry Serpent).
 *
 *  ROCKSLIDE was half-authored: the travel table fires enc_rockslide_cinematic
 *  (24 s cinematic, NO choices, ends on a scene swap) and nothing ever reached
 *  enc_rockslide — whose description was "Rockslide!" and whose Go Around /
 *  Go Under / Go Over buttons had no checks, no read-back and no outcome
 *  beats. Players saw a landslide, then nothing. Now: the cinematic ends on
 *  "Go go go GO—" → enc_rockslide; enc_rockslide gets prose + three checks
 *  (op.logistics 12 / ath 14 / prc 12 — engine keys: ath = Athletics, prc = Perception) + a no-check wait; seven new
 *  outcome beats (success + fail per route, plus the wait), each ending on a
 *  single Onward. Fails and the wait cost one leg of time, like the bridge's
 *  long way around.
 *
 *  LYRENN "The Lesson Doesn't Land" (lyrenn_gentle_pest_teach_fail, seeded
 *  2026-08-22) was orphaned: "Teach a local" failed into the generic
 *  _try_again. Now it fails into its own beat, which keeps a "Try something
 *  else" back to the menu so the retry isn't lost.
 *
 * Idempotent (label / emptiness guards); DRY_RUN default true; backs up
 * `campaigns` before the write. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw); // never mutate the live cache on a dry run
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const QUEST = "quest_travel_encounters";
  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const ONWARD = () => ch("Onward", "");
  const outcome = (id, questStep, label, description, memoryText, { timePoints = 0, tags = "travel rockslide" } = {}) => ({
    id, label, type: "outcome_trigger", description, memoryText,
    tags, politicalTags: "",
    encounter: { key: "rockslide", tier: 1, actorName: null },
    scene: { uuid: "" },
    choices: [ONWARD()],
    worldEffects: [],
    timeScale: "leg", timePoints,
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [], questId: QUEST, questStep, questRole: null, targetHexUuid: null, turnNumber: null,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] },
    audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false },
    refs: {}, pacing: { ambient: true },
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
  });
  const addBeat = (nb) => {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); return; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`);
  };

  /* ── ROCKSLIDE ─────────────────────────────────────────────────────────── */
  const NEW_BEATS = [
    outcome("enc_rockslide_around_success", 441, "Rockslide — The Scenic Route",
      "The ridge shoulder holds. It's longer, it's lumpier, and about halfway along it you get the kind of view that goes on postcards, in places that still have postcards.\n\nBy the time you rejoin the road on the far side, the slide has finished settling and looks almost smug about it. You are not even slightly late.\n\nWrite that down somewhere Pike can see it.",
      "The party routed around a rockslide along the ridge and lost no time."),
    outcome("enc_rockslide_around_fail", 442, "Rockslide — The Scenic Route (Extended)",
      "The ridge shoulder holds. The map does not.\n\nTwo false ridgelines and one argument about which way is \"obviously north\" later, you come down onto the road on the far side of the slide — dusty, tired, and in the full, humbling knowledge that you can still SEE where you started from.\n\nSomeone says \"I told you so.\" It was not you.",
      "The party went around a rockslide and got lost on the ridge — a leg of travel spent.", { timePoints: 1 }),
    outcome("enc_rockslide_over_success", 443, "Rockslide — Up and Over",
      "You go up it like it owes you money.\n\nThe scree slides, you slide with it, and at the top there is one magnificent second where the whole valley is laid out for you and the second pine tree finally lets go behind you with a sound like applause.\n\nYou come down the far side on your heels and your dignity. Mostly intact. Mostly.",
      "The party climbed straight over a fresh rockslide."),
    outcome("enc_rockslide_over_fail", 444, "Rockslide — Down and Over",
      "Scree is just stairs that haven't agreed on a direction yet, and the direction they pick is DOWN.\n\nYou surf the first ten feet with real style. The next thirty are less a technique than a position. You arrive at the bottom of the far side with the slide, in the slide, and briefly AS the slide.\n\nThen you dig the wagon out, which takes the rest of the daylight.",
      "The party tried to climb a rockslide, rode it down the far side, and spent the daylight digging out.", { timePoints: 1 }),
    outcome("enc_rockslide_under_success", 445, "Rockslide — The Culvert",
      "There it is: a concrete throat under the old roadbed, pre-Shattering, built by people who believed in drainage the way other people believe in gods.\n\nIt is dark, it drips, and something in it has made a nest out of a traffic cone. It also goes all the way through.\n\nYou come out the far side blinking and smelling of two centuries of weather, and the mountain never even notices.",
      "The party found an old culvert and went under a rockslide."),
    outcome("enc_rockslide_under_fail", 446, "Rockslide — The Culvert (Occupied)",
      "There is a culvert. You find it the way you find a step in the dark.\n\nIt goes in about forty feet, and then it goes into about forty feet of MOUNTAIN, and in between there is a thing that has made a nest out of a traffic cone and would like you to know that it was here first.\n\nYou back out. You back out carefully. Then it's the long way round after all, with a new story nobody will believe.",
      "The culvert under the rockslide was blocked (and occupied); the party went the long way round.", { timePoints: 1 }),
    outcome("enc_rockslide_wait", 447, "Rockslide — Let the Mountain Finish",
      "You wait.\n\nThe mountain settles with the long, grinding satisfaction of a thing that has waited a very long time to be a slightly different shape. The second pine tree comes down around dusk — politely, like it had an appointment.\n\nBy morning the slide has found its angle of repose, and so have you. The far side turns out to be a scramble instead of a gamble. Tedious. Safe. You'll live. That is, apparently, the deal.",
      "The party waited out a rockslide — a day spent instead of a risk taken.", { timePoints: 1, tags: "travel rockslide slow_lane" })
  ];
  for (const nb of NEW_BEATS) addBeat(nb);

  // enc_rockslide: prose + checks (guarded on the stub text / empty routing so a re-run is a no-op)
  {
    const b = byId.get("enc_rockslide");
    if (!b) report.push("⚠ enc_rockslide: NOT FOUND");
    else {
      const stubDesc = !String(b.description || "").trim() || String(b.description || "").trim() === "Rockslide!";
      const dead = (b.choices || []).every(c => !String(c?.next || "").trim() && !String(c?.checkStat || "").trim());
      if (stubDesc && dead) {
        b.description = "The slope finishes shrugging.\n\nThe road is now a rumour under forty feet of mountain, and the mountain is still settling in with little clicks and sighs, like a theatre audience after the lights go down. Somewhere above you, a second pine tree is making up its mind.\n\nThe far side of the slide is RIGHT THERE. Annoyingly close. The kind of close that makes people do things their chiropractor would call \"a choice.\"";
        b.choices = [
          ch("Go Around", "Maps. Scouts. A sensible detour along the shoulder of the ridge. Someone will say \"I told you so\" either way — be the one who gets to.",
             { checkStat: "op.logistics", checkDC: 12, next: "enc_rockslide_around_success", failNext: "enc_rockslide_around_fail" }),
          ch("Go Over", "Scree is just stairs that haven't agreed on a direction yet. Climb it before it changes its mind.",
             { checkStat: "ath", checkDC: 14, next: "enc_rockslide_over_success", failNext: "enc_rockslide_over_fail" }),
          ch("Go Under", "The old road had a drainage culvert. You are almost sure of this. You are betting the wagon on \"almost.\"",
             { checkStat: "prc", checkDC: 12, next: "enc_rockslide_under_success", failNext: "enc_rockslide_under_fail" }),
          ch("Wait for the mountain to finish", "The mountain is clearly not done. Let it have its moment. You have snacks. You HAD snacks.",
             { next: "enc_rockslide_wait" })
        ];
        b.timeScale = b.timeScale || "scene";
        changes++; report.push("✚ enc_rockslide: prose + 3 checks + wait wired");
      } else report.push("· ok enc_rockslide: already authored");
    }
  }

  // cinematic → the dialog
  {
    const b = byId.get("enc_rockslide_cinematic");
    if (!b) report.push("⚠ enc_rockslide_cinematic: NOT FOUND");
    else if (!(b.choices || []).length) {
      b.choices = [ch("Go go go GO—", "", { next: "enc_rockslide" })];
      changes++; report.push("✚ enc_rockslide_cinematic: chains to enc_rockslide");
    } else report.push(`· ok enc_rockslide_cinematic: ${b.choices.length} choice(s) already`);
  }

  /* ── LYRENN — the lesson gets its own failure ─────────────────────────── */
  {
    const p = byId.get("lyrenn_the_gentle_pest"), f = byId.get("lyrenn_gentle_pest_teach_fail");
    if (!p || !f) report.push(`⚠ lyrenn: missing ${!p ? "lyrenn_the_gentle_pest" : "lyrenn_gentle_pest_teach_fail"}`);
    else {
      const c = (p.choices || []).find(x => /teach a local/i.test(String(x?.label || "")));
      if (!c) report.push("⚠ lyrenn_the_gentle_pest: no 'Teach a local' choice");
      else if (c.failNext !== "lyrenn_gentle_pest_teach_fail") { report.push(`✚ lyrenn 'Teach a local' failNext ${c.failNext} → lyrenn_gentle_pest_teach_fail`); c.failNext = "lyrenn_gentle_pest_teach_fail"; changes++; }
      else report.push("· ok lyrenn 'Teach a local' failNext");
      for (const x of (f.choices || [])) if (String(x?.next || "") === "lyrenn_main_scene") { x.next = "lyrenn_quest_scene"; changes++; report.push(`✚ lyrenn_gentle_pest_teach_fail: "${x.label}" → lyrenn_quest_scene (was the Act-1 intro scene, sealed once Act 2 opens; siblings exit to the quest scene)`); }
      if (!f.inject && p.inject) { f.inject = foundry.utils.deepClone(p.inject); changes++; report.push("✚ lyrenn_gentle_pest_teach_fail: inherits the parent's inject gate (storyPhase ≥ 2) — the seed had none, so the lint read it as an Act 0 jump"); }
      if (f.turnNumber == null && p.turnNumber != null) { f.turnNumber = p.turnNumber; changes++; report.push(`✚ lyrenn_gentle_pest_teach_fail: turnNumber ${p.turnNumber} (matches its siblings; the lint inferred Act 0)`); }
      if (!(f.choices || []).some(x => String(x?.next || "") === "lyrenn_the_gentle_pest")) {
        f.choices = [ch("Try something else", "The bugs are still here. So are you.", { next: "lyrenn_the_gentle_pest" }), ...(f.choices || [])];
        changes++; report.push("✚ lyrenn_gentle_pest_teach_fail: + 'Try something else' back to the menu");
      } else report.push("· ok lyrenn_gentle_pest_teach_fail has its retry");
    }
  }

  console.log(`[patch-rockslide-lyrenn] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Rockslide + Lyrenn patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Rockslide + Lyrenn patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-rockslide-lyrenn-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Rockslide + Lyrenn patch APPLIED: ${changes} change(s). The mountain is finished.`);
})();
