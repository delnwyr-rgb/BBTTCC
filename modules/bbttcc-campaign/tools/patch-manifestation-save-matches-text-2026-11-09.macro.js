/*
 * patch-manifestation-save-matches-text-2026-11-09.macro.js — Dave at the Fixit stalker fight (2026-11-09): Spoiler Alert's text
 * says "Mind defense vs Cast DC" but the engine rolled Body. A sweep of the party's 46 workings found 10 where the save the
 * engine rolls ≠ the save the text names. The text is the promise ("every choice does what it says"), so the data follows it.
 *   For every manifestation item on CHARACTER actors, in world items, and in the RFI Starter Manifestations pack whose
 *   description names "<Attr> defense|save|check vs …": the save the engine rolls is
 *     shape "save", or "auto"/"attack" with hitSave → resolution.saveAttribute; otherwise (states only) appliedStates.saveAttribute.
 *   If that differs from the text's attribute, BOTH resolution.saveAttribute and appliedStates.saveAttribute → the text's.
 *   system.manifestation.tier is written with its current value in the same update so the preUpdateItem Magnitude
 *   re-score skips (a save attribute is not a magnitude change; drift there is held for Dave).
 *   Also: Wrath-Brand's text "2d6 thermal" → "1d6 thermal" (Dave's 11-08 ruling; the data is already 1d6).
 *   Items whose text names a save but whose data rolls none (Wrath-Brand: "or Burning", no state set) are REPORTED, not
 *   changed — adding Burning lifts it to T2 (inert for a T1 Steward), Dave's call.
 * Ember Bad Eden. globalThis.__saveTextDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__saveTextDry !== false;
  const report = { DRY_RUN, fixed: [], noSaveInData: [], text: [], skipped: [] };
  const strip = (x) => String(x || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const ATTRS = ["body", "mind", "soul", "presence", "violence", "intrigue"];

  async function fixItem(it, where) {
    const mf = it.system?.manifestation; if (!mf) return;
    const desc = strip(it.system?.description?.value ?? it.system?.description);
    const m = desc.match(/\b(Body|Mind|Soul|Presence|Violence|Intrigue)\s+(defen[cs]e|save|check)\s+vs/i);
    const u = {};
    if (m) {
      const txt = m[1].toLowerCase();
      const r = mf.resolution || {};
      const st = Array.isArray(mf.appliedStates?.states) ? mf.appliedStates.states : [];
      const rollsRes = r.shape === "save" || ((r.shape === "auto" || r.shape === "attack") && r.hitSave === true);
      const eff = rollsRes ? r.saveAttribute : (st.length ? mf.appliedStates?.saveAttribute : null);
      if (!eff) report.noSaveInData.push(`${where}: ${it.name} (text: ${txt})`);
      else if (eff !== txt && ATTRS.includes(txt)) {
        if (mf.resolution) u["system.manifestation.resolution.saveAttribute"] = txt;
        if (mf.appliedStates) u["system.manifestation.appliedStates.saveAttribute"] = txt;
        report.fixed.push(`${where}: ${it.name} ${eff} → ${txt}`);
      }
    }
    if (it.name === "Wrath-Brand") {
      const raw = String(it.system?.description?.value ?? "");
      if (/2d6 thermal/.test(raw)) { u["system.description.value"] = raw.replace(/2d6 thermal/g, "1d6 thermal"); report.text.push(`${where}: Wrath-Brand 2d6 → 1d6`); }
    }
    if (!Object.keys(u).length) return;
    u["system.manifestation.tier"] = mf.tier;   // pin: skip the Magnitude re-score
    if (!DRY_RUN) await it.update(u);
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
  }
  console.log("SAVETEXT " + JSON.stringify(report));
  return report;
})();
