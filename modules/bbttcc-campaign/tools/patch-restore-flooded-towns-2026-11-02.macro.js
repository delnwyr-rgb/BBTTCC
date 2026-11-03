/**
 * patch-restore-flooded-towns-2026-11-02.macro.js — THE HEX FLOODED TOWNS COME BACK (Dave 2026-11-02: "I think they come back. They don't
 * necessarily make sense after we do the cleansing bit."). patch-defer-expansion (2026-10-21) parked the whole quest behind an Act-9
 * gate; its "restore" mode brings back EVERY deferred strand (the Gift, the Balcones, the Hum, Lyrenn's and Khezek-Tor's chapters), so this
 * restores the Flooded Towns ONLY, exactly the way that macro would, and gives them their window:
 *   • each flooded_towns beat gets its original inject.requires back (from beat._deferred) + { storyPhase lte 5 } — before the Bunker;
 *     after the finale's cleansing the floods no longer make sense, so they stay shut in Act 6
 *   • choices elsewhere that led into them get their original requires back (choice._deferred)
 *   • the quest returns from act 9 to its original act (q._deferredAct, 3) and is evergreen within its window (the act ladder would
 *     otherwise seal it when Act 3 ends unstarted)
 *   • their travel-table rows get their weights back (row._deferredWeight)
 * Idempotent (rerun = 0). DRY_RUN first. Backups (campaigns + tables) → Data/bbttcc-exports/. GM only.
 */
const FLOOD_PATCH = (() => {
  const Q = "flooded_towns", WINDOW = { flag: "storyPhase", lte: 5 };
  const isGate9 = (c) => c && typeof c === "object" && c.flag === "storyPhase" && Number(c.gte) === 9;
  const hasWindow = (arr) => Array.isArray(arr) && arr.some(c => c && c.flag === "storyPhase" && c.lte != null);
  function apply(camp, tables) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0, tableChanges = 0;
    const D = new Set(beats.filter(b => b?.story?.quest === Q).map(b => b.id));
    report.push(`flooded set: ${D.size} beats`);
    for (const b of beats) {
      if (D.has(b.id)) {
        if (b._deferred) { const o = b._deferred.requires; b.inject = b.inject || {}; b.inject.requires = o == null ? [] : (Array.isArray(o) ? o : [o]); delete b._deferred; changes++; report.push(`✚ ${b.id}: original gate back`); }
        else if (Array.isArray(b.inject?.requires) && b.inject.requires.some(isGate9)) { b.inject.requires = b.inject.requires.filter(c => !isGate9(c)); changes++; }
        b.inject = b.inject || {}; const r = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []);
        if (!hasWindow(r)) { b.inject.requires = [...r, { ...WINDOW }]; changes++; }
        if (b.inject.evergreen !== true) { b.inject.evergreen = true; changes++; }
        continue;
      }
      for (const c of (b.choices || [])) {
        if (!c?._deferred) continue; if (!(D.has(String(c.next || "")) || D.has(String(c.failNext || "")))) continue;
        const o = c._deferred.requires; if (o == null) delete c.requires; else c.requires = o; delete c._deferred; changes++; report.push(`✚ ${b.id}: "${String(c.label).slice(0, 40)}" → ${c.next} shown again`);
      }
    }
    const q = camp.story?.quests?.[Q];
    if (!q) conflicts.push("quest def flooded_towns not found in story data");
    else {
      if (Number(q.act) === 9) { q.act = q._deferredAct ?? 3; delete q._deferredAct; changes++; report.push(`✚ ${Q}: act → ${q.act}`); }
      if (q.evergreen !== true) { q.evergreen = true; changes++; report.push(`✚ ${Q}: evergreen within its window`); }
    }
    for (const t of Object.values(tables || {})) for (const e of (t?.entries || [])) if (e && D.has(String(e.beatId || "")) && e._deferredWeight != null) { e.weight = e._deferredWeight; delete e._deferredWeight; tableChanges++; }
    if (tableChanges) report.push(`✚ ${tableChanges} travel-table rows weighted again`);
    return { changes, tableChanges, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = FLOOD_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const tabRaw = game.settings.get(NS, "encounterTables"); const tabWasStr = typeof tabRaw === "string";
  const tables = JSON.parse(tabWasStr ? tabRaw : JSON.stringify(tabRaw || {}));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, tableChanges, report, conflicts } = FLOOD_PATCH.apply(camp, tables);
  console.log(`[restore flooded towns 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} beat + ${tableChanges} table change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__flood = { dry: DRY_RUN, changes: changes + tableChanges, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes + tableChanges} change(s); see console.`);
  if (!(changes + tableChanges)) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-flooded-restore-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
    await FP.upload("data", "bbttcc-exports", new File([tabWasStr ? tabRaw : JSON.stringify(tabRaw)], `backup-tables-pre-flooded-restore-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tableChanges) await game.settings.set(NS, "encounterTables", tabWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Applied — the Flooded Towns are back, before the Bunker.`);
})();
