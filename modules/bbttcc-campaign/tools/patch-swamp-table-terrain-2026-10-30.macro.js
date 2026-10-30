/**
 * patch-swamp-table-terrain-2026-10-30.macro.js — Dave, 10-30 ("Yes please" to the table sweep). Sweep of all travel
 * tables (bbttcc-campaign.encounterTables) for rows whose conditions don't match their table: the ONLY real fault is
 * travel_swamp_t1 — 8 rows copied from the plains table still carry conditions.terrain "plains", so on a swamp leg only
 * the 0-weight (parked) rows qualified and the swamp T1 table rolled nothing. Those rows → terrain "swamp".
 * (Not changed: enc_hexknight's conditions.tier "3" on the T1 tables — tier is not read by the picker; the row is held
 *  by phaseGte 3, which is deliberate.)
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", KEY = "encounterTables";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, KEY);
  const wasStr = typeof raw === "string";
  const tables = JSON.parse(wasStr ? raw : JSON.stringify(raw));
  const report = []; const conflicts = []; let changes = 0;
  const tab = tables?.travel_swamp_t1;
  if (!tab) conflicts.push("travel_swamp_t1: table not found");
  else for (const e of (tab.entries || [])) {
    const c = e?.conditions; if (!c || typeof c !== "object") continue;
    if (String(c.terrain || "").toLowerCase() === "plains") { c.terrain = "swamp"; changes++; report.push(`✎ travel_swamp_t1 ${e.beatId} (w ${e.weight}): terrain plains → swamp`); }
  }
  console.log(`[swamp table terrain 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__swampTable = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([wasStr ? raw : JSON.stringify(raw)], `backup-encounterTables-pre-swamp-terrain-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, KEY, wasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Applied ${changes} change(s) — the swamp T1 table rolls swamp encounters again.`);
})();
