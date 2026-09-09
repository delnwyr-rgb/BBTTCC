/* dedupe-doctrine-items.macro.js — one feat Item per doctrine key per faction (2026-09-09, "all six" #5)
 * The faction sheet's Maneuvers / Strategic Activities lists are the actor's
 * doctrine feat Items (flags.bbttcc.{kind,key}). Duplicates of the same kind+key
 * (re-seeded grants, restores, older loaders) showed as "Logistics Surge ×4".
 * Removes every duplicate beyond the first per faction. Also reports items whose
 * key is unknown to EFFECTS or is a retired row (left alone unless REMOVE_RETIRED).
 * DRY_RUN default true. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const REMOVE_RETIRED = false;         // <-- also delete items for keys the planner has retired
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const EFFECTS = game.bbttcc?.api?.raid?.EFFECTS || {};
  const isFaction = (a) => a?.getFlag?.("bbttcc-factions", "isFaction") === true || !!a?.flags?.["bbttcc-factions"]?.opBank;
  const changes = []; const deletions = [];
  for (const A of game.actors.filter(isFaction)) {
    const seen = new Map();
    for (const it of A.items) {
      if (String(it.type) !== "feat") continue; const f = it.flags?.bbttcc || {}; const kind = String(f.kind || "").toLowerCase(), key = String(f.key || "").toLowerCase(); if (!kind || !key) continue;
      const k = `${kind}:${key}`;
      if (seen.has(k)) { deletions.push([A, it.id]); changes.push(`${A.name}: − duplicate ${it.name} (${k})`); continue; }
      seen.set(k, it.id);
      const spec = EFFECTS[key];
      if (!spec) changes.push(`${A.name}: ? ${it.name} (${k}) — key unknown to EFFECTS (left alone)`);
      else if (spec.retired) { if (REMOVE_RETIRED) { deletions.push([A, it.id]); changes.push(`${A.name}: − retired ${it.name} (${k})`); } else changes.push(`${A.name}: ~ ${it.name} (${k}) is a RETIRED row (set REMOVE_RETIRED to drop it)`); }
    }
  }
  console.group(`[dedupe-doctrine] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} finding(s), ${deletions.length} deletion(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Doctrine dedupe DRY RUN: ${deletions.length} deletion(s) in console (F12). Set DRY_RUN=false to apply.`);
  const byActor = new Map(); for (const [A, id] of deletions) { if (!byActor.has(A)) byActor.set(A, []); byActor.get(A).push(id); }
  for (const [A, ids] of byActor) await A.deleteEmbeddedDocuments("Item", ids);
  ui.notifications.info(`Doctrine dedupe: ${deletions.length} duplicate item(s) removed.`);
})();
