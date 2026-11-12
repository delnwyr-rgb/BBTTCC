/*
 * patch-fixit-counter-graded-2026-11-11.macro.js — Dave (2026-11-11): "let's add those items to FFF" — the 78 graded arms seeded today
 * (Inlaid / Circuited / Crowned on the rest of the T1 Baseline weapons + armor) go on the Furrier's Fixit Farm market (the Counter),
 * each at its own price. Already-listed items skipped. Ember Bad Eden. globalThis.__gradedDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__gradedDry !== false;
  const VID = "furriers-fixit-farm";
  const BASES = "Auto Pistol|Carbine|Felling Axe|Greatsword|Holdout Pistol|Hunting Bow|Longsword|Mace|Machine Pistol|Machete|Pump Shotgun|Quarterstaff|Sawed-Off Shotgun|Service Rifle|Shortsword|Slugger Bat|Spear|Warhammer|Ballistic Vest|Flak Jacket|Riding Leathers|Riot Armor|Riot Shield|Scrap Helm|Scrap Plate|Tactical Harness".split("|");
  const NAMES = BASES.flatMap(b => ["Inlaid", "Circuited", "Crowned"].map(g => `${g} ${b}`));
  const report = { DRY_RUN, added: [], skipped: [], missing: [] };
  const pack = game.packs.get("bbttcc-master-content.items");
  const idx = await pack.getIndex({ fields: ["flags.fourththing.rfi.item.price"] });
  const cat = foundry.utils.deepClone(game.settings.get("bbttcc-market", "catalog") || []);
  const have = new Set(cat.filter(e => e.vendorId === VID).map(e => e.uuid));
  for (const n of NAMES) {
    const i = [...idx].find(x => x.name === n);
    if (!i) { report.missing.push(n); continue; }
    const uuid = `Compendium.bbttcc-master-content.items.Item.${i._id}`;
    if (have.has(uuid)) { report.skipped.push(n); continue; }
    const p = i.flags?.fourththing?.rfi?.item?.price || {};
    cat.push({ id: "counter-" + i._id, vendorId: VID, kind: "gear", name: n, blurb: "", uuid, cost: { [String(p.currency || "violence")]: Math.max(1, Number(p.marks) || 60) } });
    report.added.push(n);
  }
  if (!DRY_RUN && report.added.length) await game.settings.set("bbttcc-market", "catalog", cat);
  console.log("GRADED " + JSON.stringify({ added: report.added.length, skipped: report.skipped.length, missing: report.missing }));
  return report;
})();
