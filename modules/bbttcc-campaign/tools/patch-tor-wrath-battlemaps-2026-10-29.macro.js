/**
 * patch-tor-wrath-battlemaps-2026-10-29.macro.js — Dave, 10-29: "the Tor-Wrath encounter at the seal… needs to happen
 * on battlemap Scene.ewhnzejDEXX69yOl." + "Same thing for the East Wall fight… Scene.3uuTDbAt9NgbqK6S." The 10-28 macro gave kt_seal_tor_wrath the Old Seal's POV scene
 * (khezek_tor_valhaulan_seal_pov, qt9yU49SP1rtO0Vw); the fight now opens the valhaulan seal hexchrome battlemap, where
 * the spawner places three Tor-Wrath + the played Stewards. The won/lost beats stay on the POV scene (back at the seal).
 * The East Wall fight (ag_east_wall_tor_wrath) likewise opens the East Wall battlemap; its won/lost beats stay put.
 * The rope shaft (Dave, 10-29: "battlemap Scene.ZnsoInY3R0nbn5q7; POV cinematic here - Scene.XeWPENTnOfo8yqFB"): the fight
 * kt_shaft_tor_wrath opens khezek_tor_tor_wrath_hexchrome_battlemap; the climb (ans_kt_cage_shaft_rope) and the win
 * (kt_shaft_tor_wrath_won, still down at Four) play on the pit POV. The climb's fail, the lost beat (back up the rope) and
 * kt_dropped_manifest (also reached from the cage) stay on maw_pov.
 * Follows patch-tor-wrath-seal-gate-2026-10-28 (which now writes this scene on a fresh apply).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const WANT = {
    kt_seal_tor_wrath: "ewhnzejDEXX69yOl", ag_east_wall_tor_wrath: "3uuTDbAt9NgbqK6S",
    kt_shaft_tor_wrath: "ZnsoInY3R0nbn5q7", ans_kt_cage_shaft_rope: "XeWPENTnOfo8yqFB", kt_shaft_tor_wrath_won: "XeWPENTnOfo8yqFB"
  };
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  for (const sc of Object.values(WANT)) if (!game.scenes.get(sc)) return ui.notifications.error(`Scene ${sc} not in this world — nothing written.`);
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  let changes = 0; const report = [];
  for (const [BEAT, SCENE] of Object.entries(WANT)) {
    const b = beats.find(x => x && String(x.id) === BEAT);
    if (!b) return ui.notifications.error(`${BEAT} not found — run patch-tor-wrath-seal-gate-2026-10-28 first.`);
    if (String(b.sceneId || "").replace(/^Scene\./, "") === SCENE) continue;
    report.push(`↻ ${BEAT} scene ${b.sceneId} → ${SCENE} (${game.scenes.get(SCENE).name})`);
    b.sceneId = SCENE; changes++;
  }
  console.log(`[tor-wrath battlemaps 2026-10-29] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__twSealMap = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-tw-battlemaps-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Tor-Wrath fights open their battlemaps.`);
})();
