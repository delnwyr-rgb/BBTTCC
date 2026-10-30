/**
 * patch-fixit-exteriors-go-in-2026-10-30.macro.js — Dave, 10-30: "'just look at the Gullywasher exterior' launches the
 * exterior beat whose verbiage explicitly tells you to go inside, and then it shifts to the inside, and the town hub menu
 * stops." All four Fixit Farm exteriors were choiceless cinematics whose cinematic.nextSceneId pulled the table inside
 * after ~30s — no choices = the chain ends, so nothing inside ever opened. Now each exterior is the doorway:
 *   fixit_saloon_cinematic        → "Go in" fixit_gullywasher_welcome
 *   fixit_general_store_exterior  → "Go in" fixit_general_store_coversation
 *   fixit_arc_bay_exterior        → "Go in" fixit_arc_bay_conversation
 *   fixit_power_station_exterior  → "Go in" fixit_power_station_conversation
 *   + "Back to the yard" → fixit_intro_scene on each; cinematic.nextSceneId cleared (the chosen beat moves the scene).
 * Yard menus (fixit_intro_scene + fixit_town_walk): "The Gullywasher — just look at the outside" → "The Gullywasher",
 *   shown until the exterior has played; "The bar. First round's cultural." shown once it has (no double door).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const B = (id) => beats.find(x => x && String(x.id) === id);
  const J = (x) => JSON.stringify(x);
  const report = []; const conflicts = []; let changes = 0;
  const ch = (label, next) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" });

  const DOORS = [
    ["fixit_saloon_cinematic", "fixit_gullywasher_welcome"],
    ["fixit_general_store_exterior", "fixit_general_store_coversation"],
    ["fixit_arc_bay_exterior", "fixit_arc_bay_conversation"],
    ["fixit_power_station_exterior", "fixit_power_station_conversation"]
  ];
  for (const [ext, inside] of DOORS) {
    const e = B(ext); if (!e) { conflicts.push(`${ext}: beat not found`); continue; }
    if (!B(inside)) { conflicts.push(`${inside}: beat not found`); continue; }
    const want = [ch("Go in", inside), ch("Back to the yard", "fixit_intro_scene")];
    if (J((e.choices || []).map(c => [c.label, c.next])) !== J(want.map(c => [c.label, c.next]))) { report.push(`   was: ${(e.choices || []).map(c => c.label).join(" / ") || "(no choices)"}`); e.choices = want; changes++; report.push(`✎ ${ext}: Go in → ${inside} · Back to the yard`); }
    if (e.cinematic && e.cinematic.nextSceneId) { report.push(`✎ ${ext}: cinematic.nextSceneId ${e.cinematic.nextSceneId} → null (the chosen beat moves the scene)`); e.cinematic.nextSceneId = null; changes++; }
  }
  for (const hubId of ["fixit_intro_scene", "fixit_town_walk"]) {
    const h = B(hubId); if (!h) { conflicts.push(`${hubId}: beat not found`); continue; }
    for (const c of h.choices || []) {
      if (c.next === "fixit_saloon_cinematic") {
        if (c.label !== "The Gullywasher") { report.push(`✎ ${hubId}: "${c.label}" → "The Gullywasher"`); c.label = "The Gullywasher"; changes++; }
        const r = [{ beatMark: "fixit_saloon_cinematic", not: true }];
        if (J(c.requires || null) !== J(r)) { c.requires = r; changes++; report.push(`✎ ${hubId} "The Gullywasher": shown until the outside has been seen`); }
      }
      if (c.next === "fixit_gullywasher_welcome") {
        const r = [{ beatMark: "fixit_saloon_cinematic" }];
        if (J(c.requires || null) !== J(r)) { c.requires = r; changes++; report.push(`✎ ${hubId} "${c.label}": shown once the outside has been seen`); }
      }
    }
  }

  console.log(`[fixit exteriors go in 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__fixitDoors = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-fixit-doors-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — every Fixit Farm exterior is a door now.`);
})();
