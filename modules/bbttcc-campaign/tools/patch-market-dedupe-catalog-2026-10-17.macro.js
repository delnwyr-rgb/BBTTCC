/* patch-market-dedupe-catalog-2026-10-17.macro.js — ONE ROW PER ITEM PER VENDOR (Dave, 2026-10-17):
 *  "let's get rid of the extra sail barge please :)" — the Arc Bay listed Sail Barge Frame twice (two catalog
 *  entries, same vendor, same compendium uuid). Generic: for every (vendorId, uuid) that appears more than once
 *  among gear/actor entries, the FIRST entry stays and the later copies go. Non-uuid kinds (rig / facility /
 *  hex_asset / upgrades) are untouched. `ONLY_NAMES` limits the sweep to named items; first pass took the Sail
 *  Barge alone, then Dave ruled "take 'em all" on the other 10 (Mall ×6 armor, Long Market ×4) — set is empty now.
 *  Idempotent; DRY_RUN default true; backs up the catalog setting. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const MOD = "bbttcc-market";
  const raw = game.settings.get(MOD, "catalog") || [];
  const catalog = foundry.utils.deepClone(Array.isArray(raw) ? raw : []);
  const ONLY_NAMES = new Set([]);   // empty = every duplicate (Dave, 2026-10-17: "take 'em all")
  const seen = new Map(); const drop = []; const report = [];
  for (const e of catalog) {
    const uuid = String(e?.uuid || "").trim();
    if (!uuid) continue;
    if (ONLY_NAMES.size && !ONLY_NAMES.has(String(e?.name || ""))) continue;
    const key = `${e?.vendorId || ""}|${uuid}`;
    if (seen.has(key)) { drop.push(e); report.push(`✚ drop duplicate "${e.name}" at ${e.vendorId || "no vendor"} (keeps ${seen.get(key).id})`); }
    else seen.set(key, e);
  }
  if (!drop.length) report.push("· ok no duplicate (vendor, uuid) rows");
  console.log(`[patch-market-dedupe-catalog] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${drop.length} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Catalog dedupe DRY RUN: ${drop.length} duplicate row(s) (see console).`);
  if (!drop.length) return ui.notifications.info("Catalog dedupe: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(raw), "text/json", `backup-market-catalog-before-dedupe-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(MOD, "catalog", catalog.filter(e => !drop.includes(e)));
  ui.notifications.info(`Catalog dedupe APPLIED: ${drop.length} duplicate row(s) removed.`);
})();
