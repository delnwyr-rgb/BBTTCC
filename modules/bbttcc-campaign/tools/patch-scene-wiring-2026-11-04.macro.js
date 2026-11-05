/**
 * patch-scene-wiring-2026-11-04.macro.js — Dave 2026-11-04: "wire the already built scenes". Beats that had no view, or a dead one, now use scenes that were already built.
 * Later beats in a chain keep inheriting the view, so only the entry points are set. Scenes are looked up by name, so this also works on a world with other ids.
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const SCENE_WIRING_PATCH = (() => {
  // [beat, scene, overwrite an existing live scene?]
  const WIRE = [
    ["raid_thatwards_ho_finale_entry", "Valhaulan Infiltration"],
    ["finale_leygate_arrival", "Valhaulan Infiltration"],
    ["raid_thatwards_infiltration_alarm", "Valhaulan Infiltration"],
    ["raid_thatwards_courtly_sklar", "vault_bunker_diplomacy"],
    ["finale_sklars_arithmetic", "vault_bunker_diplomacy"],
    ["finale_sklar_unmoved", "vault_bunker_diplomacy"],
    ["raid_thatwards_assault_open", "Valhaulan Barracks"],
    ["odie_hex_room", "Hexheart Chamber"],
    ["enc_slippage_wraith", "slippage wraith hexchrome battlemap"],
    ["enc_spark_echo", "spark echo hexhchrome battlemap"],
    ["enc_spark_echo_rare", "spark echo hexhchrome battlemap"],
    ["enc_border_incident_remote", "asli_bad_eden_remote_parley"],   // its own scene was deleted
    ["cadence_battle", "dance_battle_pov"],
    ["cadence_floor_contest", "dance off"],
    ["gilbert_theater_intro", "hidden_vault_gilbert_theater_pov"],
    ["gilbert_theater_fight", "hidden_vault_gilbert_theater"],
    ["gilbert_theater_resolution", "hidden_vault_gilbert_theater_redeemed"],
    ["allesh_gilliam_plumb_tower_exterior", "Plumb's Tower External POV", true],   // an exterior beat that sat on the office interior
    ["lyrenn_forest_will_not_be_fought_force_fight", "forest_would_not_be_fought_battlemap", true],   // the fight beat sat on the POV
    ["enc_minor_radiation_pocket", "irradiated_zone_hexchrome_pov", true]   // the opener sees the POV; its choices keep the battlemap
  ];
  // [beat, cinematic field, scene]: the start scene was deleted, so the cinematic had nothing to show
  const CINE = [
    ["balcones_faulting_you_line_opening", "startSceneId", "balcones_faulting_you_pov"],
    ["enc_rockslide_cinematic", "startSceneId", "Rockslide"]
  ];
  function apply(camp, sceneIdOf) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const live = (ref) => { const k = String(ref || "").replace(/^Scene\./, "").trim(); return !!k && sceneIdOf.has(k); };
    for (const [id, name, overwrite] of WIRE) {
      const b = beats.find(x => x?.id === id), sid = sceneIdOf.byName(name);
      if (!b) { conflicts.push(`beat not found: ${id}`); continue; }
      if (!sid) { conflicts.push(`scene not found: ${name}`); continue; }
      if (String(b.sceneId || "").replace(/^Scene\./, "") === sid) continue;
      if (live(b.sceneId) && !overwrite) { conflicts.push(`${id}: already on another scene, left alone`); continue; }
      b.sceneId = sid; changes++; report.push(`✚ ${id} → ${name}`);
    }
    for (const [id, field, name] of CINE) {
      const b = beats.find(x => x?.id === id), sid = sceneIdOf.byName(name);
      if (!b?.cinematic) { conflicts.push(`cinematic not found: ${id}`); continue; }
      if (!sid) { conflicts.push(`scene not found: ${name}`); continue; }
      if (live(b.cinematic[field])) continue;
      b.cinematic[field] = `Scene.${sid}`; changes++; report.push(`✚ ${id} cinematic ${field} → ${name}`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = SCENE_WIRING_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__sceneWiringDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = JSON.parse(wasStr ? raw : JSON.stringify(raw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const idx = { has: (id) => game.scenes.has(id), byName: (n) => game.scenes.getName(n)?.id || null };
  const { changes, report, conflicts } = SCENE_WIRING_PATCH.apply(camp, idx);
  globalThis.__sceneWiring = { dry: DRY_RUN, changes, report, conflicts };
  console.log(`[scene wiring] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    await FP.upload("data", "bbttcc-exports", new File([wasStr ? raw : JSON.stringify(raw)], `backup-campaigns-pre-scene-wiring-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — scene wiring (${changes} change(s)).`);
})();
