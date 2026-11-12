/*
 * patch-fixit-counter-stock-2026-11-11.macro.js — Dave (2026-11-11): "add some consumables and gear, tier 1 and tier 2, from the
 * catalog" to the Furrier's Fixit Farm market (the Counter). 32 picks from bbttcc-master-content.items, each at its own rubric price
 * (flags.fourththing.rfi.item.price {marks, currency}). Rig frames/modules (the Arc Bay's line), Halloween Hoard loot and curios left
 * out. Entries Dave added by hand are untouched; an item already listed for this vendor is skipped.
 * Ember Bad Eden. globalThis.__stockDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__stockDry !== false;
  const VID = "furriers-fixit-farm";
  const NAMES = [
    "Antidote Cartridge", "Calmpact Vial", "Clarity Wafer", "Field Patch", "Iodine Capsule", "Self-Wrapping Sandwich", "The Apologizing Burger",
    "Adrenal Burn", "Atonement Lozenge", "Communion Tea", "Coolant Glycerol", "Decay Inhibitor", "Memory Restorative", "Noise Suppressant", "Stim Spike",
    "Filtermask Mk II", "Geiger Familiar Drone", "Grapnel Spool", "Hex Boots", "Hex Compass", "Hex-Script Tinder Box", "Radcloth Hood",
    "Rust-Ooze Solvent Vial", "Scrapwork Toolkit", "Septlight Lantern",
    "Horizon Courier Pack", "Jackalope Haggler's Ledger", "Potion of Radical Chill", "Proselyte Recon Drone", "Reactor Shield Cape", "Scrubber Harness", "Vow-Bound Cuffs"
  ];
  const report = { DRY_RUN, added: [], skipped: [], missing: [] };
  const pack = game.packs.get("bbttcc-master-content.items");
  const idx = await pack.getIndex({ fields: ["flags.fourththing.rfi.item.price", "system.description"] });
  const cat = foundry.utils.deepClone(game.settings.get("bbttcc-market", "catalog") || []);
  const have = new Set(cat.filter(e => e.vendorId === VID).map(e => e.uuid));
  for (const n of NAMES) {
    const i = [...idx].find(x => x.name === n);
    if (!i) { report.missing.push(n); continue; }
    const uuid = `Compendium.bbttcc-master-content.items.Item.${i._id}`;
    if (have.has(uuid)) { report.skipped.push(n); continue; }
    const p = i.flags?.fourththing?.rfi?.item?.price || {};
    const cur = String(p.currency || "economy"), marks = Math.max(1, Number(p.marks) || 10);
    cat.push({ id: "counter-" + i._id, vendorId: VID, kind: "gear", name: n, blurb: "", uuid, cost: { [cur]: marks } });
    report.added.push(`${n} (${marks} ${cur})`);
  }
  if (!DRY_RUN && report.added.length) await game.settings.set("bbttcc-market", "catalog", cat);
  console.log("STOCK " + JSON.stringify({ added: report.added.length, skipped: report.skipped.length, missing: report.missing }));
  return report;
})();
