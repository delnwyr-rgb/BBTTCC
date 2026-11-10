/*
 * patch-shaken-riders-swap-2026-11-09.macro.js — Dave 2026-11-09: Shaken now makes the target vulnerable to Stress damage
 * (×2), so a working that BOTH deals Stress damage AND applies Shaken would double itself. Dave: "Staggered please for
 * strikethrough, Footnote, unsolicited jingle, penalty clause, and mercy's edge. For the others on the list, let's apply
 * blinded." (the others = Sudden Memory Of A Bee, Lensing, The Real Shape, Unmasking Flash).
 *   For every item with those names (character actors, NPCs, world items, the RFI Starter Manifestations pack):
 *   appliedStates.states: "shaken" → the new state; the description's "Shaken" → "Staggered" / "Blinded"
 *   (plus the Shaken gloss, if present, → the new state's). Tier: the Magnitude score with the new state is reported
 *   (report.tier) and written only if it doesn't exceed the stored tier — a rise is held (report.held) for Dave.
 * Ember Bad Eden. globalThis.__shakenSwapDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__shakenSwapDry !== false;
  const MAP = {
    "Strikethrough": "staggered", "Footnote": "staggered", "Unsolicited Jingle": "staggered",
    "Penalty Clause": "staggered", "Mercy's Edge": "staggered",
    "Sudden Memory Of A Bee": "blinded", "Lensing": "blinded", "The Real Shape": "blinded", "Unmasking Flash": "blinded"
  };
  const LABEL = { staggered: "Staggered", blinded: "Blinded" };
  const report = { DRY_RUN, swapped: [], tier: [], held: [], noShaken: [], skipped: [] };
  const M = game.fourththing.manifestation;

  async function fix(it, where) {
    const want = MAP[it.name]; if (!want) return;
    const mf = it.system?.manifestation; if (!mf) return;
    const states = Array.isArray(mf.appliedStates?.states) ? mf.appliedStates.states.slice() : [];
    const i = states.indexOf("shaken");
    if (i < 0) { if (!states.includes(want)) report.noShaken.push(`${where}: ${it.name} [${states.join("/") || "-"}]`); return; }
    states[i] = want;
    const next = [...new Set(states)];
    const u = { "system.manifestation.appliedStates.states": next };
    const raw = String(it.system?.description?.value ?? "");
    const desc = raw.replace(/\bShaken\b/g, LABEL[want]).replace(/\bshaken\b/g, want);
    if (desc !== raw) u["system.description.value"] = desc;
    const kind = it.type === "weapon" ? "weapon" : "power";
    const preview = foundry.utils.mergeObject(it.toObject(), { system: { manifestation: { appliedStates: { states: next } } } }, { inplace: false });
    const stored = Number(mf.tier) || 1, scored = M.magnitudeTier(preview, kind);
    report.tier.push(`${where}: ${it.name} T${stored} → scores T${scored}`);
    if (scored > stored) { report.held.push(`${where}: ${it.name} would score T${scored} (stored T${stored})`); return; }
    u["system.manifestation.tier"] = stored;   // keep the stored tier (a lower score is the held re-tier's business)
    report.swapped.push(`${where}: ${it.name} shaken → ${want}`);
    if (!DRY_RUN) await it.update(u);
  }

  for (const a of game.actors.contents) for (const it of a.items.contents) { try { await fix(it, a.name); } catch (e) { report.skipped.push(`${a.name}/${it.name}: ${e.message}`); } }
  for (const it of game.items.contents) { try { await fix(it, "world"); } catch (e) { report.skipped.push(`world/${it.name}: ${e.message}`); } }
  const pack = game.packs.get("fourththing.starter-manifestations");
  if (pack) {
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try { for (const it of await pack.getDocuments()) { try { await fix(it, "pack"); } catch (e) { report.skipped.push(`pack/${it.name}: ${e.message}`); } } }
    finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  }
  console.log("SHAKENSWAP " + JSON.stringify(report));
  return report;
})();
