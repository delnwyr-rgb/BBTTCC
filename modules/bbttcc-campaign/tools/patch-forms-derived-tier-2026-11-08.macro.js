/*
 * patch-forms-derived-tier-2026-11-08.macro.js — Dave at the East Wall (2026-11-08): "There's nothing preventing me from
 * checking all of the states … and the system will still call it a Tier 1 manifestation. One that doesn't even cost
 * clarity." Rulings: tier is DERIVED from magnitude; a Form above your tier is inert; a Form can't pay zero; Wrath-Brand
 * drops to 1d6. The system code carries the rules (ftManifestationMagnitudeTier, ftIsManifestedForm, the Engage gate,
 * the cost floor, the preUpdateItem re-score). This macro brings EXISTING data up to them:
 *   1. Wrath-Brand → 1d6 everywhere (character actors, world items, the starter pack); effect text follows.
 *   2. Stamp manifested Forms (flags.fourththing.manifested = true) on character actors, world items and the RFI
 *      Starter Manifestations pack: a weapon with a concept, a real cost, a "bound" tag or a "path:" tag. Guns have none.
 *   3. Re-score every stamped Form's tier from its magnitude — WRITTEN only with globalThis.__formsTierRetier = true (the
 *      2026-11-08 dry run found 19 legacy Forms and 109 powers scoring high, mostly scene scale / 30 ft range). Powers are
 *      REPORTED only (report.powerDrift); re-tiering the starter kits mid-playtest is Dave's call.
 * Ember Bad Eden. globalThis.__formsTierDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__formsTierDry !== false;
  const RETIER = globalThis.__formsTierRetier === true;
  const report = { DRY_RUN, RETIER, wrathBrand: [], stamped: [], retiered: [], powerDrift: [], skipped: [] };
  const M = game.fourththing?.manifestation;
  if (!M?.magnitudeTier) throw new Error("game.fourththing.manifestation missing — deploy + restart the system first");

  const isFormCandidate = (it) => {
    if (it.type !== "weapon") return false;
    if (foundry.utils.getProperty(it, "flags.fourththing.manifested") === true) return false;
    // 2026-11-08 (teeth P30): the system's one Form test when deployed (game.fourththing.formWeaponHeuristic).
    if (typeof game.fourththing?.formWeaponHeuristic === "function") return game.fourththing.formWeaponHeuristic(it);
    const mf = it.system?.manifestation ?? {};
    const tags = (it.system?.tags ?? []).map(t => String(t).toLowerCase());
    return !!String(mf.concept ?? "").trim() || (mf.costType && mf.costType !== "none") || tags.includes("bound") || tags.some(t => t.startsWith("path:"));
  };

  async function fixItem(it, where) {
    const u = {};
    // 1. Wrath-Brand → 1d6
    if (it.name === "Wrath-Brand" && String(it.system?.damage?.formula ?? "").replace(/\s+/g, "") === "2d6") {
      u["system.damage.formula"] = "1d6";
      const eff = String(it.system?.effect ?? "");
      if (eff.includes("2d6")) u["system.effect"] = eff.replace(/2d6/g, "1d6");
      report.wrathBrand.push(where);
    }
    // 2. Stamp
    let stamped = foundry.utils.getProperty(it, "flags.fourththing.manifested") === true;
    if (!stamped && isFormCandidate(it)) { u["flags.fourththing.manifested"] = true; stamped = true; report.stamped.push(`${where}: ${it.name}`); }
    // 3. Re-score (Forms applied; powers reported)
    const preview = foundry.utils.mergeObject(it.toObject(), foundry.utils.expandObject(u), { inplace: false });
    const cur = Math.max(1, Math.min(4, Number(it.system?.manifestation?.tier) || 1));
    if (stamped) {
      // Owner as the 3rd arg (fix round 2026-11-08, S6); a null score (scoring error) never writes.
      const t = M.magnitudeTier(preview, "weapon", it.parent ?? null);
      // The dry run of 2026-11-08 showed 19 legacy Forms (and 109 powers) scoring above their authored tier — mostly
      // scale "scene" / range 30 ft on starter kits. Re-tiering them locks Stewards out mid-playtest, so the write is
      // opt-in: globalThis.__formsTierRetier = true. The report always lists them.
      if (t != null && t !== cur) { if (RETIER) u["system.manifestation.tier"] = t; report.retiered.push(`${where}: ${it.name} T${cur}→T${t}${RETIER ? "" : " (held)"}`); }
    } else if (it.type === "power" && it.system?.manifestation) {
      const t = M.magnitudeTier(preview, "power", it.parent ?? null);
      if (t != null && t !== cur) report.powerDrift.push(`${where}: ${it.name} T${cur}→T${t}`);
    }
    if (!DRY_RUN && Object.keys(u).length) await it.update(u);
    return Object.keys(u).length;
  }

  for (const a of game.actors.contents) {
    if (a.type !== "character") continue;
    for (const it of a.items.contents) { try { await fixItem(it, a.name); } catch (e) { report.skipped.push(`${a.name}/${it.name}: ${e.message}`); } }
  }
  for (const it of game.items.contents) { try { await fixItem(it, "world"); } catch (e) { report.skipped.push(`world/${it.name}: ${e.message}`); } }
  const pack = game.packs.get("fourththing.starter-manifestations");
  if (pack) {
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try { for (const it of await pack.getDocuments()) { try { await fixItem(it, "pack"); } catch (e) { report.skipped.push(`pack/${it.name}: ${e.message}`); } } }
    finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  } else report.skipped.push("starter pack not found");

  console.log("FORMSTIER " + JSON.stringify(report));
  return report;
})();
