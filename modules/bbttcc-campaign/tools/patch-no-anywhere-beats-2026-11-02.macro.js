/**
 * patch-no-anywhere-beats-2026-11-02.macro.js — owner ruling (Dave 2026-11-02): "I don't like the idea of anywhere beats anymore. I want
 * things to either happen at a specific hex, and if the conditions aren't met yet it doesn't trigger, or have it be a random encounter.
 * For things we want to make sure happen, they should be hardcoded." Lint P10 (ft-lint-campaign) lists every placeless beat nothing
 * reaches; this gives each one a home:
 *   AUTO-FIRE (inject.autoFire — plays itself once its requires hold; module.js _autoFireSweep): the Act Three card, the Valhaulan spine
 *     bridges, Geburah's "answerable to nobody" verdict, and the Bandit Accord's cards (each already gated on banditMercy).
 *   ROAD TABLES (random encounters): the Wendigo's road meeting (plains/forest T1–T2) — its `wendigoRung ≥ 1` requires comes off (the
 *     rung only climbs FROM Wendigo meetings — the Accord's 11-01 deadlock again; the meeting now climbs it), Desenitarius Maarg
 *     (ashwastes/canyons T2–T3), Scout Signs (plains/forest/canyons; the valuable variant T2–T3), the Circuit Riders' Colossus (plains/canyons T2).
 *   A HEX: the Polygonal Grove breadcrumb → where "The Polygonal Grove".
 * Pure apply(camp, tables) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backups → Data/bbttcc-exports/. GM only.
 */
const NO_ANYWHERE_PATCH = (() => {
  const AUTO = ["a3_title_card", "vs_overture", "vs_bridge_seal", "vs_bridge_triangle", "vs_bridge_corroboration", "vs_bridge_muster",
    "spark_geburah_verdict_taken", "bandit_accord_opening", "bandit_word_spreads", "bandit_volunteers", "bandit_envoy"];
  const ROAD = [
    { beatId: "fc_road_wendigo", weight: 2, tables: ["travel_plains_t1", "travel_forest_t1", "travel_plains_t2", "travel_forest_t2"] },
    { beatId: "enc_desenitarius_maarg", weight: 1, tables: ["travel_ashwastes_t2", "travel_ashwastes_t3", "travel_canyons_t2", "travel_canyons_t3"] },
    { beatId: "enc_scout_signs", weight: 1, tables: ["travel_plains_t1", "travel_forest_t1", "travel_canyons_t1", "travel_plains_t2", "travel_forest_t2", "travel_canyons_t2"] },
    { beatId: "enc_scout_signs_valuable", weight: 1, tables: ["travel_plains_t2", "travel_forest_t2", "travel_canyons_t2", "travel_plains_t3", "travel_forest_t3", "travel_canyons_t3"] },
    { beatId: "enc_circuit_riders_colossus", weight: 1, tables: ["travel_plains_t2", "travel_canyons_t2"] }
  ];
  const WHERE = { polygonal_grove_breadcrumb: "The Polygonal Grove" };
  const terrainOf = (tid) => (String(tid).match(/^travel_([a-z]+)_t(\d)$/) || [])[1] || null;
  const tierOf = (tid) => (String(tid).match(/_t(\d)$/) || [])[1] || null;
  function apply(camp, tables) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const by = new Map(beats.map(b => [b?.id, b]));
    const report = [], conflicts = []; let changes = 0, tableChanges = 0;
    for (const id of AUTO) { const b = by.get(id); if (!b) { conflicts.push(`${id} not found`); continue; } b.inject = b.inject || {}; if (b.inject.autoFire === true) { report.push(`· ok auto ${id}`); continue; } b.inject.autoFire = true; changes++; report.push(`✚ ${id}: autoFire (plays itself when its conditions hold)`); }
    const wd = by.get("fc_road_wendigo");
    if (wd && Array.isArray(wd.inject?.requires)) { const before = wd.inject.requires.length; wd.inject.requires = wd.inject.requires.filter(r => !(r && r.flag === "wendigoRung")); if (wd.inject.requires.length !== before) { changes++; report.push(`✚ fc_road_wendigo: wendigoRung gate removed (the meeting climbs the rung)`); } }
    for (const [id, w] of Object.entries(WHERE)) { const b = by.get(id); if (!b) { conflicts.push(`${id} not found`); continue; } if (b.where === w) { report.push(`· ok where ${id}`); continue; } b.where = w; changes++; report.push(`✚ ${id}: where "${w}"`); }
    for (const r of ROAD) {
      const b = by.get(r.beatId); if (!b) { conflicts.push(`${r.beatId} not found`); continue; }
      const phaseReq = (Array.isArray(b.inject?.requires) ? b.inject.requires : []).find(x => x && x.flag === "storyPhase" && x.gte != null);
      for (const tid of r.tables) {
        const t = tables?.[tid]; if (!t || !Array.isArray(t.entries)) { conflicts.push(`table ${tid} missing`); continue; }
        if (t.entries.some(e => e && e.beatId === r.beatId)) { report.push(`· ok ${tid} ∋ ${r.beatId}`); continue; }
        const cond = { terrain: terrainOf(tid), tier: tierOf(tid) }; cond.phaseGte = phaseReq ? Number(phaseReq.gte) : 2;
        t.entries.push({ campaignId: camp.id, beatId: r.beatId, weight: r.weight, conditions: cond }); tableChanges++;
        report.push(`✚ ${tid} += ${r.beatId} (w${r.weight}, act ≥ ${cond.phaseGte})`);
      }
    }
    return { changes, tableChanges, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = NO_ANYWHERE_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const tabRaw = game.settings.get(NS, "encounterTables"); const tabWasStr = typeof tabRaw === "string";
  const tables = JSON.parse(tabWasStr ? tabRaw : JSON.stringify(tabRaw || {}));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, tableChanges, report, conflicts } = NO_ANYWHERE_PATCH.apply(camp, tables);
  console.log(`[no anywhere beats 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} beat + ${tableChanges} table change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__noAnywhere = { dry: DRY_RUN, changes: changes + tableChanges, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes + tableChanges} change(s); see console.`);
  if (!(changes + tableChanges)) return ui.notifications.info("Nothing to change.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-no-anywhere-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
    await FP.upload("data", "bbttcc-exports", new File([tabWasStr ? tabRaw : JSON.stringify(tabRaw)], `backup-tables-pre-no-anywhere-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tableChanges) await game.settings.set(NS, "encounterTables", tabWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Applied ${changes} beat + ${tableChanges} table change(s) — every beat has a home.`);
})();
