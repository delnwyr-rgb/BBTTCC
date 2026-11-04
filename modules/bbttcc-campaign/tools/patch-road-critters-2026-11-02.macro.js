/**
 * patch-road-critters-2026-11-02.macro.js — THE ROAD'S CREATURES PAY THEIR BOUNTIES (failure pass, Dave 2026-11-02: "Are we getting our
 * marks credited for overcoming the monsters?" → "We need a critter" → the mutant ladder "Apex predator (T3); Waste Stalker (Tier 2);
 * Scavenger Beast (1)").
 * 14 of 20 award beats named a creature slug with no bestiary actor (`[awards] no bounty for mutant_wildlife_t2`), so killing, talking
 * down or parleying them paid nothing. Each award now names its critter, and the encounters name their foe so a real fight spawns it:
 *   • mutant_wildlife_t2 → Wastes Stalker (T II, 10 marks)   • mutant_wildlife_t3 → Apex Predator (T III, 40 heavy)
 *   • geometry_serpent   → Jommetry Serpent (T I, 5; pack — the spawner imports it once by exact name)
 *   • bandit_ambush      → Road Bandit (T I mortal, 5) — awards only; the ambush battlemap pre-places its own bandit tokens
 *     (and swaps in the Drowned South crew after the Accord), so its encounters keep actorName empty.
 * Encounter tiers and table weights are untouched. Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const ROAD_CRITTERS_PATCH = (() => {
  const MAP = {
    mutant_wildlife_t2: { name: "Wastes Stalker", spawn: true },
    mutant_wildlife_t3: { name: "Apex Predator", spawn: true },
    geometry_serpent:   { name: "Jommetry Serpent", spawn: true },
    bandit_ambush:      { name: "Road Bandit", spawn: false }
  };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = []; let changes = 0;
    for (const b of beats) {
      const a = b?.award;
      if (a && typeof a === "object" && MAP[a.creature]) { report.push(`✚ ${b.id}: award ${a.method} ${a.creature} → ${MAP[a.creature].name}`); a.creature = MAP[a.creature].name; changes++; }
      const e = b?.encounter, m = e && MAP[e.key];
      if (m && m.spawn && e.actorName !== m.name) { e.actorName = m.name; changes++; report.push(`✚ ${b.id}: encounter foe → ${m.name}`); }
    }
    return { changes, report, conflicts: [] };
  }
  return { apply, MAP };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ROAD_CRITTERS_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__roadCrittersDry ?? true);   // <-- set false (or globalThis.__roadCrittersDry = false) to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  // every critter must exist (world, or the npcs pack) before we point at it
  const idx = []; for (const pid of ["bbttcc-master-content.npcs", "bad-eden-5e.monsters"]) { const pack = game.packs?.get(pid); if (pack) idx.push(...await pack.getIndex()); }   // + the D&D bestiary (2026-11-03)
  const missing = Object.values(ROAD_CRITTERS_PATCH.MAP).map(m => m.name).filter(n => !game.actors.find(a => a.name === n) && !idx.find(e => e.name === n));
  if (missing.length) { globalThis.__roadCritters = { dry: DRY_RUN, changes: 0, conflicts: missing.map(n => `critter not found: ${n}`) }; return ui.notifications.error("Missing critters: " + missing.join(", ")); }
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = ROAD_CRITTERS_PATCH.apply(camp);
  console.log(`[road critters 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__roadCritters = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-road-critters-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — the road's creatures pay their bounties (${changes} change(s)).`);
})();
