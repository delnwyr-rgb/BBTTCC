/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-conditions-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C5
 * (condition bites P03, engine-owned states out of the picker P04, Surge Anchor / initiative ward / per-state faculty P40).
 * Dave's ruling (2026-11-08, P03): "Yes" — every condition an author can tick does something in the field.
 *
 * P04: states the engine sets itself — Dying, Incapacitated, Submerged, Drowning, Crushing, Airborne, Falling, Vacuum,
 * and the ladder entries (Strained, radiation*, darkness*) — are no longer offered by the Engine grid or either item
 * sheet, and ftNormalizeManifestationData drops them from AUTHORED applied states at read time. So nothing needs
 * writing for the game to behave: a legacy item that ticked one simply stops applying it (ticking Dying used to stack
 * Last Stand failures with no Last Stand roll — a kill path). FT.CONDITIONS and the actor-sheet toggles are unchanged.
 *
 * This macro REPORTS the items whose stored applied states include an engine-owned state, and optionally strips them
 * from the stored data so sheets / exports read the same as the game.
 *
 * Covers world items, every world actor's items, and unlinked scene-token actors' items. Compendium packs are NOT touched.
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseAConditionsWrite = true → strips engine-owned keys from
 *        system.manifestation.appliedStates.states (array or { key: bool } map, written back as an array) and from
 *        appliedStates.saveAttributeOverrides. Nothing else is touched. Every write pins the item's current tier
 *        (appliedStates is a magnitude path — the preUpdateItem re-score stays off; Phase B re-scores).
 *
 * Report sections (always filled):
 *   engineOwned  — items whose authored states include an engine-owned state (now dropped at read)
 *   emptied      — of those, items left with NO authored state (the state was the whole point — re-author by hand)
 *   newTeeth     — items whose states now bite where they used to be prose: Restrained (no move on its turn, +2 to be
 *                  hit), Staggered (movement halved), Scarred (−1 max Clarity), Charmed (no Strike / hostile working at
 *                  the source), Calmed (no Strike / damaging working), Compelled (turn-start GM card), Surprised
 *                  (round-1 turn spent). Review these for power level; tier is NOT re-scored here.
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseAConditionsWrite === true;
  const ENGINE_OWNED = new Set(["incapacitated", "dying", "submerged", "drowning", "crushing", "airborne", "falling", "vacuum"]);
  // The ladder entries of FT.CONDITIONS (Strain, radiation, Darkness).
  const isLadder = (k) => /^(strained$|radiation[A-Z]|darkness[A-Z])/.test(k);
  const engineOwned = (k) => ENGINE_OWNED.has(k) || isLadder(k);
  const NEW_TEETH = new Set(["restrained", "staggered", "scarred", "charmed", "calmed", "compelled", "surprise"]);
  const report = { WRITE, world: game.world?.id, engineOwned: [], emptied: [], newTeeth: [], errors: [], scanned: 0 };

  const statesOf = (st) => Array.isArray(st) ? st.filter(Boolean).map(String)
    : (st && typeof st === "object" ? Object.entries(st).filter(([, v]) => v === true || v === "true").map(([k]) => k) : []);

  async function checkItem(it, where) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const src = it._source?.system ?? it.system ?? {};
    const mf = src.manifestation ?? {};
    const ap = mf.appliedStates;
    if (!ap || typeof ap !== "object") return;
    report.scanned++;
    const label = `${where}: ${it.name} [${it.type}] (${it.uuid})`;
    const states = statesOf(ap.states);
    const bad = states.filter(engineOwned);
    const keep = states.filter(k => !engineOwned(k));
    const teeth = keep.filter(k => NEW_TEETH.has(k));
    if (teeth.length) report.newTeeth.push(`${label} — ${teeth.join(", ")}`);
    const ovr = (ap.saveAttributeOverrides && typeof ap.saveAttributeOverrides === "object") ? ap.saveAttributeOverrides : {};
    const badOvr = Object.keys(ovr).filter(engineOwned);
    if (!bad.length && !badOvr.length) return;
    report.engineOwned.push(`${label} — ${[...bad, ...badOvr.filter(k => !bad.includes(k)).map(k => `${k} (override only)`)].join(", ")}${keep.length ? ` · keeps ${keep.join(", ")}` : ""}`);
    if (bad.length && !keep.length) report.emptied.push(`${label} — only had ${bad.join(", ")}`);
    if (!WRITE) return;
    const u = {
      "system.manifestation.appliedStates.states": keep,
      "system.manifestation.tier": Math.max(1, Math.min(4, Number(mf.tier) || 1))   // pin: no re-score
    };
    for (const k of badOvr) u[`system.manifestation.appliedStates.saveAttributeOverrides.-=${k}`] = null;
    try { await it.update(u); } catch (e) { report.errors.push(`${label}: ${e.message}`); }
  }

  for (const it of game.items.contents) await checkItem(it, "world");
  for (const a of game.actors.contents) for (const it of a.items.contents) await checkItem(it, a.name);
  for (const sc of game.scenes.contents) {
    for (const tok of sc.tokens.contents) {
      if (tok.actorLink || !tok.actor) continue;
      for (const it of tok.actor.items.contents) {
        // Only items the token's delta actually overrides — base items were already scanned on the world actor.
        if (!tok.delta?.items?.get?.(it.id)) continue;
        await checkItem(it, `${sc.name} / ${tok.name}`);
      }
    }
  }

  const summary = `teeth Phase A conditions — ${WRITE ? "WRITTEN" : "DRY RUN"}: scanned ${report.scanned}; `
    + `engine-owned states authored ${report.engineOwned.length} (left empty ${report.emptied.length}); `
    + `states with new teeth ${report.newTeeth.length}; errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
