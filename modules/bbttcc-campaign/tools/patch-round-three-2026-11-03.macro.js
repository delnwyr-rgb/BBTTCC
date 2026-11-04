/**
 * patch-round-three-2026-11-03.macro.js — story fixes from round three of the GM click-through (a real four-Steward party).
 *   • Verification Begins (Circuit Riders): after all three questions the hub had no way out, only greyed repeats. "Terms of contact" now
 *     appears there once all three have been asked.
 *   • The Fifteen-Year Siege is PARKED (Dave 2026-11-03: "Let's skip it"): its hex lives only on an unlinked scene, so NOW's Ride-to button stranded the GM. Its one entry,
 *     siege_market_day, now also requires beatMark "siege_unparked", which nothing sets. Unpark: remove that row once the Siege has a door on the main map.
 *   • The Act Three card closes once Act Three has passed (2026-11-04), as Acts Four and Five do: with no upper limit, a table that settled
 *     Khezek-Tor late would get "Act Three" in the middle of a later act.
 *   • Gloomgill's questions run in order (2026-11-04): only Question 1 carried the lamp gate, so Resume skipped to Question 2, sent the table back
 *     to a lake that refused them, and its Run next would have stepped past the gate. Each question now requires the one before it.
 *   • Chuckle Creek is a place (2026-11-04): its hub fired once, so a party that left mid-quest rode back to silence. It repeats now, with a way back to the road.
 *   • Leaving Gloomgill before his exam isn't a verdict (2026-11-04): "Leave" went to gloomgill_fled, which closes the quest for good, even while he was
 *     refusing to begin and telling the party to come back. It's the walk-out verdict only once the exam is open; before that, the lake just lets you go.
 *   • No fighting Gloomgill (Dave 2026-11-04: "Let's remove the fight option"): the Fight choice and its two beats are gone. The text survives in fix-gloomgill-exam.macro.js.
 *   • Lines (Dave 2026-11-04): Chuckle Creek's street knows you've been here; the finale's exit stops calling itself clean and knows if you let Tarvaan finish; Sklar turns
 *     at the bunker mouth on the Siege path, not mid-swing.
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const ROUND_THREE_PATCH = (() => {
  const HUB = "enc_circuit_riders_parley_respect";
  const TERMS = "enc_circuit_riders_parley_resolution";
  const ASKED = ["enc_circuit_riders_pressure_doctrine", "enc_circuit_riders_pressure_darkness", "enc_circuit_riders_pressure_witness"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const hub = beats.find(b => b?.id === HUB);
    if (!hub) conflicts.push(`beat not found: ${HUB}`);
    else if (!beats.some(b => b?.id === TERMS)) conflicts.push(`beat not found: ${TERMS}`);
    else if (!(hub.choices || []).some(c => c?.next === TERMS)) {
      hub.choices = [...(hub.choices || []), { label: "Terms of contact", next: TERMS, description: "", checkStat: "", checkDC: 0, failNext: "", requires: ASKED.map(beatMark => ({ beatMark })) }];
      changes++; report.push(`✚ ${HUB}: "Terms of contact" once all three questions are asked`);
    }
    const siege = beats.find(b => b?.id === "siege_market_day");
    if (!siege) conflicts.push("beat not found: siege_market_day");
    else {
      siege.inject = siege.inject || {};
      const req = Array.isArray(siege.inject.requires) ? siege.inject.requires : [];
      if (!req.some(r => r?.beatMark === "siege_unparked")) { siege.inject.requires = [...req, { beatMark: "siege_unparked" }]; changes++; report.push("✚ siege_market_day: parked (requires siege_unparked)"); }
    }
    const a3 = beats.find(b => b?.id === "a3_title_card");
    if (!a3) conflicts.push("beat not found: a3_title_card");
    else {
      a3.inject = a3.inject || {};
      const req = Array.isArray(a3.inject.requires) ? a3.inject.requires : [];
      if (!req.some(r => r?.flag === "storyPhase" && r?.lte === 3)) { a3.inject.requires = [...req, { flag: "storyPhase", lte: 3 }]; changes++; report.push("✚ a3_title_card: closes after Act Three"); }
    }
    const creek = beats.find(b => b?.id === "chuckle_arrival");
    if (!creek) conflicts.push("beat not found: chuckle_arrival");
    else {
      creek.inject = creek.inject || {};
      if (creek.inject.repeatable !== true) { creek.inject.repeatable = true; changes++; report.push("✚ chuckle_arrival: repeats on return"); }
      if (!(creek.choices || []).some(c => c?.label === "Back on the road.")) {
        creek.choices = [...(creek.choices || []), { label: "Back on the road.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }];
        changes++; report.push("✚ chuckle_arrival: road exit");
      }
    }
    const gg = beats.find(b => b?.id === "gloomgill_intro_scene");
    const ggTalk = gg && (gg.choices || []).find(c => c?.next === "gloomgill_question_1");
    const ggWait = gg && (gg.choices || []).find(c => c?.next === "gloomgill_unfinished");
    const ggLeave = gg && (gg.choices || []).find(c => c?.next === "gloomgill_fled");
    if (!ggTalk?.requires || !ggWait?.requires || !ggLeave) conflicts.push("gloomgill_intro_scene: gate choices not found");
    else {
      if (!ggLeave.requires) { ggLeave.requires = JSON.parse(JSON.stringify(ggTalk.requires)); changes++; report.push("✚ gloomgill_intro_scene: the walk-out verdict waits for the open exam"); }
      if (!gg.choices.some(c => c?.label === "Leave the lake for now.")) {
        gg.choices = [...gg.choices, { label: "Leave the lake for now.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "", requires: JSON.parse(JSON.stringify(ggWait.requires)) }];
        changes++; report.push("✚ gloomgill_intro_scene: leave without a verdict while he won't begin");
      }
    }
    for (let n = 2; n <= 10; n++) {
      const q = beats.find(b => b?.id === `gloomgill_question_${n}`);
      if (!q) { conflicts.push(`beat not found: gloomgill_question_${n}`); continue; }
      q.inject = q.inject || {};
      const req = Array.isArray(q.inject.requires) ? q.inject.requires : [];
      const prev = `gloomgill_question_${n - 1}`;
      if (!req.some(r => r?.beatMark === prev)) { q.inject.requires = [...req, { beatMark: prev }]; changes++; report.push(`✚ ${q.id}: requires ${prev}`); }
    }
    // ── No fighting Gloomgill ──
    const ggIntro = beats.find(b => b?.id === "gloomgill_intro_scene");
    if (!ggIntro) conflicts.push("beat not found: gloomgill_intro_scene");
    else if ((ggIntro.choices || []).some(c => c?.next === "gloomgill_fight")) {
      ggIntro.choices = ggIntro.choices.filter(c => c?.next !== "gloomgill_fight");
      changes++; report.push("✚ gloomgill_intro_scene: Fight removed");
    }
    for (const id of ["gloomgill_fight", "gloomgill_fought"]) {
      const i = beats.findIndex(b => b?.id === id);
      if (i < 0) continue;
      const stillRouted = beats.some(b => b?.id !== "gloomgill_fight" && (b?.choices || []).some(c => c?.next === id || c?.failNext === id));
      if (stillRouted) { conflicts.push(`${id}: another beat still routes to it, left in place`); continue; }
      beats.splice(i, 1); changes++; report.push(`✚ ${id}: deleted`);
    }
    // ── Lines ──
    const rewrite = (id, marker, fn) => {
      const b = beats.find(x => x?.id === id);
      if (!b) { conflicts.push(`beat not found: ${id}`); return; }
      const d = String(b.description || "");
      if (d.includes(marker)) return;
      const out = fn(d);
      if (out === d) { conflicts.push(`${id}: expected text not found, left alone`); return; }
      b.description = out; changes++; report.push(`✚ ${id}: text`);
    };
    const CREEK_SEEN = "cc_diner|chuckle_hollis|chuckle_piano_kid|chuckle_projector|chuckle_creek_itself";
    rewrite("chuckle_arrival", `{{#played ${CREEK_SEEN}}}`, d => `{{#played ${CREEK_SEEN}}}The street again. The sun with the face is still pleased to see you: exactly as pleased, to the same degree, which you are starting to notice. The man on the corner takes the anvil, flattens, springs back, tips his hat. The carhop loves your costume, with no memory of having said so. The creek is still enjoying the joke two rooms away. The kid is still under the piano that has not fallen yet. Nothing here has changed, and nobody finds that remarkable. {{#played chuckle_rung_4}}You know where the seam is now. The plaque goes by between the carhop's sentence and the elf's. Nobody looks up. {{/played}}Pick a door.\n\n⚙ GM: same street, same joy, same delight at seeing you, word for word if you can manage it. Let the sameness start to itch. If somebody swings at Hollis unprovoked, play "(GM) If Someone Swings".{{else}}${d}{{/played}}`);
    const TF = "You got what you came for, and you let a man be a god for one breath to do it.";
    rewrite("raid_thatwards_outcome_neutral_spark", TF, d => `{{#played odie_tarvaan_fires}}${TF} The Spark is yours. Nobody is going to round this one in your favor: the platform is cracked, the mountain felt it, and whatever looked down through that hole in the ceiling has seen who was standing under it. The truth is incomplete, but it points in the right direction: someone with money and patience redirected energies through the seal and wounded something ancient in the process. You were in the room for the second wound.{{else}}${d}{{/played}}`);
    const exit = beats.find(b => b?.id === "raid_thatwards_outcome_neutral_spark");
    if (exit && exit.label === "Clean Exit, Dirty Truth") { exit.label = "Out With the Spark, and a Dirty Truth"; changes++; report.push("✚ raid_thatwards_outcome_neutral_spark: label"); }
    const SK_OLD = "It happens in the middle of the fight, which is the only place it could. Sklar, mid-swing, with a Rider's relay crackling the figures at her from across the field";
    rewrite("odie_sklar_switches", "{{#played raid_thatwards_siege_open}}", d => d.replace(SK_OLD, `{{#played raid_thatwards_siege_open}}It happens at the bunker mouth, in whatever shift of the siege this is, which is the only place it could. Sklar, between volleys, with a Rider's relay crackling the figures at her from across the perimeter{{else}}${SK_OLD}{{/played}}`));
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ROUND_THREE_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__roundThreeDry ?? true);   // <-- set false (or globalThis.__roundThreeDry = false) to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = ROUND_THREE_PATCH.apply(camp);
  console.log(`[round three 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__roundThree = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-round-three-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — round three story fixes (${changes} change(s)).`);
})();
