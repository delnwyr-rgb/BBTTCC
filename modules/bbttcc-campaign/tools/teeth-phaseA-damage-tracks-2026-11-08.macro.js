/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-damage-tracks-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C3
 * (damage tracks P06, Clarity / Noise P07, extra dice P08, conditional damage P09).
 * Dave's rulings (2026-11-08):
 *   P06  "Track derives from damage type." — damage lands on the bar its TYPE sets (psychic / qliphothic → Stress,
 *        radiation → Radiation, everything else → Integrity) and attacks the matching defense (Stress → Resolve, else
 *        Guard). A stored damage track is ignored at read time; only heals keep an authored track (Integrity / Stress).
 *   P07  Clarity / Noise: "valid attack and buff targets, but they should only be affected by set amounts, not rolled."
 *        They moved to the manifestation's pool row (system.manifestation.poolShift { clarity, noise }, −4..4).
 *
 * The system already reads every track through ftTrackForDamage, so NOTHING needs writing for the game to behave.
 * This macro REPORTS where stored data disagrees with the derived track (the bar a hit used to land on changed),
 * and optionally rewrites the stored track to match so sheets / exports read the same.
 *
 * Covers world items + every world actor's embedded items (any actor type). Compendium packs are NOT touched.
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseADamageTracksWrite = true → rewrites stored damage tracks to the derived track:
 *        weapon system.damage.track, power system.damageRoll.track (damage op only), every damageParts[].track.
 *        Every write pins the item's current tier (damage paths are magnitude paths — the preUpdateItem re-score
 *        stays off). Heals and the Clarity / Noise heal rows below are never rewritten.
 *
 * Report sections (always filled):
 *   weaponTrack     — weapons whose stored damage.track ≠ the track their type sets (the hit now lands elsewhere;
 *                     the defense attacked follows)
 *   powerTrack      — damage-op powers whose stored damageRoll.track ≠ the derived one (incl. legacy clarity / noise
 *                     damage, which now lands on the type's bar — re-author as a pool row if the drain was the point)
 *   partTrack       — Additional Damage Dice rows whose stored track ≠ the derived one
 *   healPoolRolled  — heal-op powers aimed at Clarity / Noise with a ROLLED amount (still lands on that pool at read
 *                     time; Dave's ruling wants a set amount — move it to the pool row by hand)
 *   partsNowRolled  — powers / save-first Forms carrying Additional Damage Dice: these now roll on Invoke / save cards
 *                     (P08) — before, only Strikes rolled them
 *   conditionalRows — items with conditional (vs creature type) damage: now lands on every apply path (P09)
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseADamageTracksWrite === true;
  const TYPE_TRACK = { kinetic: "integrity", electrical: "integrity", thermal: "integrity", chemical: "integrity",
    poison: "integrity", psychic: "stress", sephirotic: "integrity", qliphothic: "stress", radiation: "radiation", energy: "integrity" };
  const derive = game.fourththing?.trackForDamage ?? ((track, type) => {
    const byType = TYPE_TRACK[String(type ?? "").toLowerCase().trim()];
    if (byType) return byType;
    const t = String(track ?? "").toLowerCase();
    return (t === "stress" || t === "radiation") ? t : "integrity";
  });
  const report = {
    WRITE, world: game.world?.id,
    weaponTrack: [], powerTrack: [], partTrack: [], healPoolRolled: [], partsNowRolled: [], conditionalRows: [], errors: []
  };
  const partsArr = (raw) => Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);

  async function checkItem(it, where) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    const label = `${where}: ${it.name} [${it.type}]`;
    const u = {};

    if (it.type === "weapon" && sys.damage && typeof sys.damage === "object") {
      const stored = String(sys.damage.track ?? "");
      const want = derive(stored, sys.damage.type);
      if (stored && stored !== want) {
        report.weaponTrack.push(`${label} — ${sys.damage.type || "untyped"}: stored ${stored} → lands on ${want}`);
        u["system.damage.track"] = want;
      }
    }
    if (it.type === "power" && sys.damageRoll && typeof sys.damageRoll === "object") {
      const dr = sys.damageRoll, op = String(dr.op ?? "none"), stored = String(dr.track ?? "");
      if (op === "damage" && Number(dr.number) > 0) {
        const want = derive(stored, dr.type || "kinetic");
        if (stored && stored !== want) {
          report.powerTrack.push(`${label} — ${dr.number}${dr.die ?? ""} ${dr.type || "kinetic"}: stored ${stored} → lands on ${want}`);
          u["system.damageRoll.track"] = want;
        }
      } else if (op === "heal" && (stored === "clarity" || stored === "noise")) {
        report.healPoolRolled.push(`${label} — heal ${dr.number}${dr.die ?? ""} → ${stored} (rolled; ruling wants a set amount in the pool row)`);
      }
    }
    const parts = partsArr(sys.damageParts).filter(p => String(p?.formula ?? "").trim());
    if (parts.length) {
      let changed = false;
      const fixed = parts.map(p => {
        const want = derive(p.track, p.type || "kinetic");
        if (p.track && p.track !== want) {
          changed = true;
          report.partTrack.push(`${label} — part ${p.formula} ${p.type || "kinetic"}: stored ${p.track} → lands on ${want}`);
        }
        return { ...p, track: want };
      });
      if (changed) u["system.damageParts"] = fixed;
      const saveFirst = it.type === "weapon" && mf.resolution?.mode === "save";
      if (it.type === "power" || saveFirst) report.partsNowRolled.push(`${label} — ${parts.map(p => `${p.formula} ${p.type || "kinetic"}`).join(", ")}${saveFirst ? " (save-first)" : ""}`);
    }
    const cd = partsArr(mf.conditionalDamage).filter(r => r?.vsType && r?.bonusFormula);
    if (cd.length) report.conditionalRows.push(`${label} — ${cd.map(r => `+${r.bonusFormula} vs ${r.vsType}`).join(", ")}`);

    if (WRITE && Object.keys(u).length) {
      u["system.manifestation.tier"] = Math.max(1, Math.min(4, Number(mf.tier) || 1));   // pin: no re-score
      try { await it.update(u); } catch (e) { report.errors.push(`${label}: ${e.message}`); }
    }
  }

  for (const it of game.items.contents) await checkItem(it, "world");
  for (const a of game.actors.contents) for (const it of a.items.contents) await checkItem(it, a.name);

  const summary = `teeth Phase A damage tracks — ${WRITE ? "WRITTEN" : "DRY RUN"}: weapon tracks ${report.weaponTrack.length}; `
    + `power tracks ${report.powerTrack.length}; part tracks ${report.partTrack.length}; rolled Clarity/Noise heals `
    + `${report.healPoolRolled.length}; extra dice now rolling on cast/save ${report.partsNowRolled.length}; `
    + `conditional rows ${report.conditionalRows.length}; errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
