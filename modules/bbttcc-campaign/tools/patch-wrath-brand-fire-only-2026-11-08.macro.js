/*
 * patch-wrath-brand-fire-only-2026-11-08.macro.js — Dave (2026-11-08): "We should remove burning from Wrath Brand
 * entirely. Primarily just want to have a weapon that does fire damage."
 * Every Wrath-Brand (character actors, NPC actors, world items, every Item compendium carrying one):
 *   - no applied states (Burning and its save gone)
 *   - 1d6 fire (thermal, flavor "hot"), Violence
 *   - effect text + mechanical hook say exactly that
 * globalThis.__wrathBrandDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__wrathBrandDry !== false;
  const report = { DRY_RUN, changed: [], already: [], skipped: [] };
  const EFFECT = "Melee attack: 1d6 fire (thermal). No rider: it just burns.";

  function planFor(it) {
    if (it.type !== "weapon" || it.name !== "Wrath-Brand") return null;
    const s = it.system ?? {}, mf = s.manifestation ?? {}, ap = mf.appliedStates ?? {};
    const states = Array.isArray(ap.states) ? ap.states.filter(Boolean)
      : Object.entries(ap.states ?? {}).filter(([, v]) => v === true).map(([k]) => k);
    const u = {};
    if (states.length) u["system.manifestation.appliedStates.states"] = Array.isArray(ap.states) ? [] : Object.fromEntries(Object.keys(ap.states).map(k => [k, false]));
    if (String(s.damage?.formula ?? "").replace(/\s+/g, "") !== "1d6") u["system.damage.formula"] = "1d6";
    if (s.damage?.type !== "thermal") u["system.damage.type"] = "thermal";
    if (s.damage?.damageFlavor !== "hot") u["system.damage.damageFlavor"] = "hot";
    if (s.effect !== EFFECT) u["system.effect"] = EFFECT;
    if (mf.mechanicalHook && /burn/i.test(mf.mechanicalHook)) u["system.manifestation.mechanicalHook"] = "";
    return Object.keys(u).length ? u : {};
  }
  async function fix(it, where) {
    const u = planFor(it); if (u === null) return;
    const label = `${where}/${it.name}`;
    if (!Object.keys(u).length) { report.already.push(label); return; }
    report.changed.push({ where: label, update: u });
    if (!DRY_RUN) await it.update(u);
  }

  for (const a of game.actors.contents) for (const it of a.items.contents) { try { await fix(it, a.name); } catch (e) { report.skipped.push(`${a.name}: ${e.message}`); } }
  for (const it of game.items.contents) { try { await fix(it, "world"); } catch (e) { report.skipped.push(`world: ${e.message}`); } }
  for (const pack of game.packs.filter(p => p.documentName === "Item" || p.documentName === "Actor")) {
    const idx = await pack.getIndex();
    const hits = pack.documentName === "Item" ? idx.filter(e => e.name === "Wrath-Brand") : idx.contents ?? [...idx];
    if (!hits.length) continue;
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try {
      if (pack.documentName === "Item") {
        for (const e of hits) { const it = await pack.getDocument(e._id); try { await fix(it, pack.collection); } catch (er) { report.skipped.push(`${pack.collection}: ${er.message}`); } }
      } else {
        for (const a of await pack.getDocuments()) for (const it of a.items.contents) { try { await fix(it, `${pack.collection}/${a.name}`); } catch (er) { report.skipped.push(`${pack.collection}/${a.name}: ${er.message}`); } }
      }
    } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  }
  console.log("Wrath-Brand fire-only", report);
  ui.notifications?.info(`Wrath-Brand: ${report.changed.length} ${DRY_RUN ? "would change" : "changed"}, ${report.already.length} already fire-only.`);
  return report;
})();
