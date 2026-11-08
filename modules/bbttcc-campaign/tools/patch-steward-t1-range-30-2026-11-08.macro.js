/*
 * patch-steward-t1-range-30-2026-11-08.macro.js — Dave at the East Wall (2026-11-08): "Let's pull the range of all our
 * Tier 1 manifestations to 30' if they are above it." With the relaxed range band (T1 ≤30 ft) a Tier 1 working that
 * reaches farther is Tier 1 in every other respect and T2+ only by its reach — Sic (120 ft) had just re-scored to T3.
 * For every manifestation item (power or Engine-made Form) on the party's Stewards whose manifestation.rangeFt > 30:
 * if the item is Tier 1 by its stored tier, OR would score Tier 1 once the range is 30 ft (range was the only thing
 * lifting it), rangeFt → 30. The preUpdateItem re-score then writes the tier. Items that would still score above T1
 * at 30 ft are reported (report.stillHigh), not touched. Also reports the matching RFI Starter Manifestations pack
 * entries (report.packWouldMatch) without changing them — "our" means the party.
 * Stewards = the four actors named below (edit STEWARDS to widen). Ember Bad Eden.
 * globalThis.__t1RangeDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__t1RangeDry !== false;
  const STEWARDS = ["Marginalia", "Marmalade", "JESSIE", "Toran Rôl"];
  const report = { DRY_RUN, pulled: [], stillHigh: [], packWouldMatch: [], skipped: [] };
  const M = game.fourththing?.manifestation;
  if (!M?.magnitudeTier) throw new Error("game.fourththing.manifestation missing — deploy + reload the system first");
  const isMf = (it) => (it.type === "power" && !!it.system?.manifestation) || M.isForm(it);

  function assess(it) {
    const mf = it.system?.manifestation ?? {};
    const range = Number(mf.rangeFt) || 0;
    if (range <= 30) return null;
    const kind = it.type === "weapon" ? "weapon" : "power";
    const stored = Math.max(1, Math.min(4, Number(mf.tier) || 1));
    const preview = foundry.utils.mergeObject(it.toObject(), { system: { manifestation: { rangeFt: 30 } } }, { inplace: false });
    const at30 = M.magnitudeTier(preview, kind);
    return { range, stored, at30, qualifies: stored === 1 || at30 === 1 };
  }

  for (const name of STEWARDS) {
    const a = game.actors.getName(name);
    if (!a) { report.skipped.push(`${name}: actor not found`); continue; }
    for (const it of a.items.contents) {
      if (!isMf(it)) continue;
      try {
        const r = assess(it); if (!r) continue;
        const line = `${a.name}: ${it.name} ${r.range} ft (T${r.stored}, T${r.at30} at 30 ft)`;
        if (!r.qualifies) { report.stillHigh.push(line); continue; }
        report.pulled.push(line);
        if (!DRY_RUN) await it.update({ "system.manifestation.rangeFt": 30 });
      } catch (e) { report.skipped.push(`${a.name}/${it.name}: ${e.message}`); }
    }
  }
  const pack = game.packs.get("fourththing.starter-manifestations");
  if (pack) for (const it of await pack.getDocuments()) {
    if (!isMf(it) && !(it.type === "weapon" && it.system?.manifestation?.concept)) continue;
    const r = assess(it); if (r?.qualifies) report.packWouldMatch.push(`${it.name} ${r.range} ft`);
  }
  console.log("T1RANGE " + JSON.stringify(report));
  return report;
})();
