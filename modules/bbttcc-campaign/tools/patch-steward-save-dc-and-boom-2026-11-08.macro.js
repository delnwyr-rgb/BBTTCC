/*
 * patch-steward-save-dc-and-boom-2026-11-08.macro.js — Dave at the East Wall (2026-11-08):
 *   "Let's get rid of the 'fixed DC' for stewards. Their save DC should always be based on them." — every
 *   manifestation item on a CHARACTER actor (Stewards; foes keep their authored "Body DC 13") has its
 *   resolution.saveDcMode and appliedStates.saveDcMode set to "cast-dc" (the ladder 11 + tier×2 + channel).
 *   The system already ignores a fixed DC for Stewards at resolution (ftSaveDCFor) and hides the option on the
 *   Engine and the sheets; this clears the stored value so the Magnitude score stops counting it (Sic had DC 18 → T3).
 *   "And let's set Boom to personal!" — This Is My BOOM Sword: manifestation.scale "scene" → "personal" wherever it
 *   lives (character actors, world items, the RFI Starter Manifestations pack). A single thrown strike is a Personal
 *   footprint; with the relaxed range band (T1 ≤30 ft) it scores T1 again. The preUpdateItem re-score runs on the
 *   scale change and writes the tier.
 * Ember Bad Eden. globalThis.__stewardDcDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__stewardDcDry !== false;
  const report = { DRY_RUN, dcCleared: [], boom: [], skipped: [] };
  const isFoe = (a) => { try { return game.fourththing?.constants && typeof _ftIsFoeActor === "function" ? _ftIsFoeActor(a) : a.type === "npc"; } catch (_e) { return a.type === "npc"; } };

  async function fixItem(it, where, { steward }) {
    const u = {};
    const mf = it.system?.manifestation;
    if (steward && mf) {
      if (mf.resolution?.saveDcMode === "fixed")    u["system.manifestation.resolution.saveDcMode"] = "cast-dc";
      if (mf.appliedStates?.saveDcMode === "fixed") u["system.manifestation.appliedStates.saveDcMode"] = "cast-dc";
      if (Object.keys(u).length) report.dcCleared.push(`${where}: ${it.name}`);
    }
    if (it.name === "This Is My BOOM Sword" && mf && mf.scale !== "personal") {
      u["system.manifestation.scale"] = "personal";
      report.boom.push(`${where}: scale ${mf.scale} → personal`);
    }
    if (!DRY_RUN && Object.keys(u).length) await it.update(u);
  }

  for (const a of game.actors.contents) {
    if (a.type !== "character") continue;
    const steward = !isFoe(a);
    for (const it of a.items.contents) { try { await fixItem(it, a.name, { steward }); } catch (e) { report.skipped.push(`${a.name}/${it.name}: ${e.message}`); } }
  }
  for (const it of game.items.contents) { try { await fixItem(it, "world", { steward: false }); } catch (e) { report.skipped.push(`world/${it.name}: ${e.message}`); } }
  const pack = game.packs.get("fourththing.starter-manifestations");
  if (pack) {
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try { for (const it of await pack.getDocuments()) { try { await fixItem(it, "pack", { steward: false }); } catch (e) { report.skipped.push(`pack/${it.name}: ${e.message}`); } } }
    finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  } else report.skipped.push("starter pack not found");

  console.log("STEWARDDC " + JSON.stringify(report));
  return report;
})();
