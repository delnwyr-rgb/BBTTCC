/**
 * reprice-gear-2026-11-03.macro.js — owner ruling, round three: "cut T2 prices … apply the same rubric to the higher tiers".
 * Scales every stamped gear price in the master item pack from the old tier base (150 / 450 / 1350) to GEAR_TIER_BASE_MARKS (60 / 70 / 85).
 * Skips hulls, materials, trade goods, gmOverride items and Tier I. Stamps price.rubric, so a rerun = 0. Set globalThis.__repriceDry = false to apply.
 * Backup → Data/bbttcc-exports/. GM only. Same arithmetic as reprice-gear-2026-11-03.core.mjs (the repo _source pass).
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const DRY = globalThis.__repriceDry ?? true;
  const RUBRIC = "gear-2026-11-03", RATIO = { II: 60 / 150, III: 70 / 450, IV: 85 / 1350 };
  const SKIP = new Set(["vehicle", "material", "trade-good"]), TYPES = new Set(["weapon", "armor", "gear", "consumable", "equipment", "tool", "container"]);
  const five = n => Math.max(5, Math.round(n / 5) * 5);
  const pack = game.packs.get("bbttcc-master-content.items"); const docs = await pack.getDocuments();
  const ups = [], backup = [];
  for (const d of docs) {
    const it = d.flags?.fourththing?.rfi?.item, p = it?.price;
    if (!p || !TYPES.has(d.type) || p.gmOverride || p.rubric === RUBRIC || SKIP.has(String(it.frame || "")) || !RATIO[it.tier]) continue;
    const r = RATIO[it.tier], marks = five((Number(p.marks) || 0) * r);
    const next = { ...p, marks, rubric: RUBRIC, saleBack: it.bound === "soulbound" ? 0 : Math.floor(marks * 0.4) };
    if (p.split && typeof p.split === "object") next.split = Object.fromEntries(Object.entries(p.split).map(([k, v]) => [k, five((Number(v) || 0) * r)]));
    ups.push({ _id: d.id, "flags.fourththing.rfi.item.price": next }); backup.push({ id: d.id, name: d.name, price: p });
  }
  // Dave 2026-11-03: Rad Suit Mk I (Tier II) drops its ×1.5 rarity; at 135 it cost more than Mk II (Tier III, 105).
  const mk1 = docs.find(d => d.name === "Rad Suit (Mk I)"), mk1p = mk1?.flags?.fourththing?.rfi?.item?.price;
  if (mk1p?.rubric === RUBRIC && mk1p.marks !== 90) { ups.push({ _id: mk1.id, "flags.fourththing.rfi.item.price": { ...mk1p, marks: 90, rarityMult: 1, saleBack: 36 } }); backup.push({ id: mk1.id, name: mk1.name, price: mk1p }); }
  globalThis.__reprice = { dry: DRY, changes: ups.length };
  if (DRY || !ups.length) return ui.notifications.info(`${DRY ? "DRY RUN — " : ""}${ups.length} gear price(s).`);
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
  try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
  await FP.upload("data", "bbttcc-exports", new File([JSON.stringify(backup)], `backup-prices-pre-reprice-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  const wasLocked = pack.locked; if (wasLocked) await pack.configure({ locked: false });
  try { for (let i = 0; i < ups.length; i += 50) await Item.updateDocuments(ups.slice(i, i + 50), { pack: pack.collection }); }
  finally { if (wasLocked) await pack.configure({ locked: true }); }
  globalThis.__reprice.done = true;
  ui.notifications.info(`Repriced ${ups.length} gear item(s).`);
})();
