/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-frame-fields-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C1 (frame fields).
 * Dave's rulings (2026-11-08):
 *   P22 Enduring: "Fold into bound. Cost per Soma break."  → stability "enduring" becomes "bound" (THE write that matters).
 *   P33 Expression / Function / Interaction Model: "flavor text … Please remove them, in the engine and as fields."
 *   P01 Scale: "Drop it."   P19 opCost: T4 costs the Steward like T1–T3.   P17 Legacy Clarity Cost / Noise Shift retired.
 *   P26 Target Shape (system.target) retired — self = range "self"; a no-target beneficial cast lands on the caster.
 * The system code no longer reads any of the removed keys (stale keys are harmless) and the normalizer already maps
 * "enduring" → "bound" at read time; this macro brings STORED data in line.
 *
 * Covers world items + every world actor's embedded items (any actor type), and each actor's active-manifestation
 * tracker (flags.fourththing.activeManifestations[].stability).
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseAFrameFieldsWrite = true  → writes enduring → bound (items + active trackers).
 *   globalThis.__teethPhaseAFrameFieldsStrip = true  → ALSO strips the retired keys (manifestation.form / function /
 *        interactionModel / scale / opCost, system.clarityRequired / noiseGain / target). Optional tidy-up. A tier-less
 *        item keeps its scale (the normalizer's load-time tier fallback still reads it).
 *   globalThis.__teethPhaseAFrameFieldsArea  = true  → ALSO gives powers whose retired Target Shape was "area"/"burst"
 *        but which have no area shape a 10-ft sphere. Area is a magnitude path → the preUpdateItem hook re-scores the
 *        tier, so this is opt-in and listed in report.areaFix first.
 * Every write pins the item's stored tier (S1), except an AREA fix (re-scored by design).
 * Idempotent. Compendium packs are NOT touched (run per world; packs are Dave's call).
 */
(async () => {
  const WRITE = globalThis.__teethPhaseAFrameFieldsWrite === true;
  const STRIP = WRITE && globalThis.__teethPhaseAFrameFieldsStrip === true;
  const AREA  = WRITE && globalThis.__teethPhaseAFrameFieldsArea === true;
  const report = { WRITE, STRIP, AREA, world: game.world?.id, enduring: [], tracker: [], strip: [], areaFix: [], errors: [] };
  const MF_KEYS  = ["form", "function", "interactionModel", "scale", "opCost"];
  const SYS_KEYS = ["clarityRequired", "noiseGain", "target"];

  const isManifestationLike = (it) => (it.type === "power" || it.type === "weapon") && !!it.system?.manifestation;

  async function fixItem(it, where) {
    if (!isManifestationLike(it)) return;
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    const u = {};
    const label = `${where}: ${it.name} [${it.type}]`;

    if (String(mf.stability ?? "").toLowerCase() === "enduring") {
      u["system.manifestation.stability"] = "bound";
      report.enduring.push(label);
    }

    const stale = [];
    for (const k of MF_KEYS) {
      if (!(k in mf)) continue;
      // The normalizer infers a tier-less item's tier from scale — keep scale where no tier is stored.
      if (k === "scale" && !(Number(mf.tier) >= 1 && Number(mf.tier) <= 4)) continue;
      stale.push(`manifestation.${k}`);
      u[`system.manifestation.-=${k}`] = null;
    }
    for (const k of SYS_KEYS) {
      if (!(k in sys)) continue;
      stale.push(k);
      u[`system.-=${k}`] = null;
    }
    if (stale.length) report.strip.push(`${label} — ${stale.join(", ")}`);
    if (!STRIP) for (const k of Object.keys(u)) if (k.includes("-=")) delete u[k];

    const tgt = String(sys.target ?? "").toLowerCase();
    if (it.type === "power" && (tgt === "area" || tgt === "burst") && (!mf.area?.shape || mf.area.shape === "none")) {
      report.areaFix.push(`${label} — target "${tgt}", no area shape → sphere 10 ft${AREA ? "" : " (held)"}`);
      if (AREA) { u["system.manifestation.area.shape"] = "sphere"; u["system.manifestation.area.size"] = 10; }
    }

    // Pin the stored tier on every write (fix round 2026-11-08, S1): stability is a magnitude path, so without the pin
    // the preUpdateItem hook would re-score the item here. The AREA option is the documented exception — giving a power
    // an area is meant to re-score. A tier-less item (scale fallback) is left to the hook.
    const areaWrite = "system.manifestation.area.shape" in u;
    const storedTier = Number(mf.tier);
    if (Object.keys(u).length && !areaWrite && Number.isFinite(storedTier) && storedTier >= 1) {
      u["system.manifestation.tier"] = Math.max(1, Math.min(4, Math.floor(storedTier)));
    }
    if (WRITE && Object.keys(u).length) {
      try { await it.update(u); } catch (e) { report.errors.push(`${label}: ${e.message}`); }
    }
  }

  for (const it of game.items.contents) await fixItem(it, "world");
  for (const a of game.actors.contents) {
    for (const it of a.items.contents) await fixItem(it, a.name);
    const active = a.getFlag?.("fourththing", "activeManifestations");
    if (Array.isArray(active) && active.some(e => e?.stability === "enduring")) {
      const next = active.map(e => e?.stability === "enduring" ? { ...e, stability: "bound" } : e);
      report.tracker.push(`${a.name}: ${active.filter(e => e?.stability === "enduring").map(e => e.itemName).join(", ")}`);
      if (WRITE) {
        try { await a.setFlag("fourththing", "activeManifestations", next); } catch (e) { report.errors.push(`${a.name} tracker: ${e.message}`); }
      }
    }
  }

  const summary = `teeth Phase A frame fields — ${WRITE ? "WRITTEN" : "DRY RUN"}: enduring→bound ${report.enduring.length} item(s), `
    + `${report.tracker.length} tracker(s); stale keys on ${report.strip.length} item(s)${STRIP ? " (stripped)" : ""}; `
    + `area fixes ${report.areaFix.length}${AREA ? "" : " (held)"}; errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
